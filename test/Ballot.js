const {time, loadFixture} = require("@nomicfoundation/hardhat-network-helpers");

const {ethers} = require("hardhat");
const {expect} = require("chai");

const day = 86400;

describe("Ballot", function () {

    async function deployBallotWithBalancesFixture() {
        const [voter1, voter2, voter3, voter4] = await ethers.getSigners();

        const VotingToken = await ethers.getContractFactory("VotingToken");
        const votingToken = await VotingToken.deploy();

        const Ballot = await ethers.getContractFactory("Ballot");
        const ballot = await Ballot.deploy(votingToken.address);

        console.log("\tBallot deployed to:", ballot.address);

        await votingToken.connect(voter1).transfer(voter2.address, 40 * 10 ** 6);
        await votingToken.connect(voter1).transfer(voter3.address, 35 * 10 ** 6);

        await votingToken.connect(voter1).delegate(voter1.address);
        await votingToken.connect(voter2).delegate(voter2.address);
        await votingToken.connect(voter3).delegate(voter3.address);

        return {
            voter1,
            voter2,
            voter3,
            voter4,
            votingToken,
            ballot
        };
    }

    describe("Deployment", function () {
        it("Should deploy the Ballot contract", async function () {
            const {ballot} = await loadFixture(deployBallotWithBalancesFixture);

            expect(ballot.address).to.properAddress;
        });

        it("Should set the VotingToken contract address", async function () {
            const {ballot, votingToken} = await loadFixture(deployBallotWithBalancesFixture);

            expect(await ballot.votingToken()).to.equal(votingToken.address);
        });

        it("Should set the proposal count to 0", async function () {
            const {ballot} = await loadFixture(deployBallotWithBalancesFixture);

            expect(await ballot.getActiveProposalsCount()).to.equal(0);
        });

        it("Should be right total supply", async function () {
            const {votingToken} = await loadFixture(deployBallotWithBalancesFixture);

            expect(await votingToken.totalSupply()).to.equal(100 * 10 ** 6);
        });

        it("Should be right balance of voters", async function () {
            const {votingToken, voter1, voter2, voter3} = await loadFixture(deployBallotWithBalancesFixture);

            expect(await votingToken.balanceOf(voter1.address)).to.equal(25 * 10 ** 6);
            expect(await votingToken.balanceOf(voter2.address)).to.equal(40 * 10 ** 6);
            expect(await votingToken.balanceOf(voter3.address)).to.equal(35 * 10 ** 6);
        });

    });

    describe("Proposals", function () {
        it("Should create a proposal", async function () {
            const {ballot, votingToken, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));


            const tx = await ballot.connect(voter1).createProposal(hash);
            const receipt = await tx.wait();

            const [event] = receipt.events.filter((e) => e.event === "ProposalCreated");

            expect(event.args.proposalId).to.equal(hash);
            expect(event.args.creator).to.equal(voter1.address);
            expect(await ballot.getProposalTtl(hash)).to.equal(await time.latest() + 3 * day);

            expect(await ballot.getActiveProposalsCount()).to.equal(1);

            const [forVotes, againstVotes] = await ballot.getProposalVotes(hash);
            expect(forVotes).to.equal(0);
            expect(againstVotes).to.equal(0);

        });

        it("Should not create a proposal if the proposal is not unique", async function () {
            const {ballot, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));

            await ballot.connect(voter1).createProposal(hash);

            await expect(ballot.connect(voter1).createProposal(hash)).to.be.revertedWith("Proposal already exists");
        });

        it("Should not create a proposal if not enough balance", async function () {
            const {ballot, voter4} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));

            await expect(ballot.connect(voter4).createProposal(hash)).to.be.revertedWith("Not enough balance");
        });

        it("Should not create a proposal if created maximum number of proposals", async function () {
            const {ballot, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const maxProposals = await ballot.MAX_PROPOSALS();

            for (let i = 0; i < maxProposals; i++) {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal " + i));
                await ballot.connect(voter1).createProposal(hash);
            }

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal " + maxProposals));
            const tx = ballot.connect(voter1).createProposal(hash);

            await expect(tx).to.be.revertedWith("Maximum number of proposals reached");
        });

        it("Should create a proposal if created maximum number of proposals and the oldest proposal is expired", async function () {
            const {ballot, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const maxProposals = await ballot.MAX_PROPOSALS();

            hashes = [];
            for (let i = 0; i < maxProposals; i++) {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal " + i));
                await ballot.connect(voter1).createProposal(hash);
                await time.increase(day);
                hashes.push(hash);
            }


            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal " + maxProposals));
            await ballot.connect(voter1).createProposal(hash);

            expect(await ballot.getActiveProposalsCount()).to.equal(maxProposals);

            expect(await ballot.getProposalState(hash)).to.equal(1);
            expect(await ballot.getProposalTtl(hash)).to.equal(await time.latest() + 3 * day);
            expect(await ballot.getProposalVotes(hash)).to.deep.equal([0, 0]);
        });
    });

    describe("Voting", function () {
        function checkVoteEvent(event, hash, voter, weight, support) {
            expect(event.args.proposalId).to.equal(hash);
            expect(event.args.voter).to.equal(voter);
            expect(event.args.weight).to.equal(weight);
            expect(event.args.support).to.equal(support);
        }


        it("Should vote for a proposal", async function () {
            const {ballot, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await ballot.connect(voter1).createProposal(hash);

            await ballot.connect(voter1).vote(hash, 10 * 10 ** 6, true);

            const [event] = await ballot.queryFilter(ballot.filters.Voted(null, null, null, null));

            checkVoteEvent(event, hash, voter1.address, 10 * 10 ** 6, true);

            const [forVotes, againstVotes] = await ballot.getProposalVotes(hash);
            expect(forVotes).to.equal(10 * 10 ** 6);
            expect(againstVotes).to.equal(0);
        });

        it("Should not vote if the proposal does not exist", async function () {
            const {ballot, votingToken, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));

            await expect(ballot.connect(voter1).vote(hash, 10 * 10 ** 6, true)).to.be.revertedWith("Proposal is not active");
        });

        it("Should not vote if the proposal is expired", async function () {
            const {ballot, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await ballot.connect(voter1).createProposal(hash);

            await time.increase(4 * day);

            await expect(ballot.connect(voter1).vote(hash, 10 * 10 ** 6, false)).to.be.revertedWith("Proposal is not active");
        });

        it("Should not vote if balance is not enough", async function () {
            const {ballot, voter1, voter4} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await ballot.connect(voter1).createProposal(hash);

            await expect(ballot.connect(voter4).vote(hash, 10 * 10 ** 9, false)).to.be.revertedWith("Not enough balance");
        });

        it("Should be able to vote multiple times if not all balance is used", async function () {
            const {ballot, voter1} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await ballot.connect(voter1).createProposal(hash);

            await ballot.connect(voter1).vote(hash, 10 * 10 ** 6, true);
            await ballot.connect(voter1).vote(hash, 10 * 10 ** 6, true);
            await ballot.connect(voter1).vote(hash, 5 * 10 ** 6, false);

            const events = await ballot.queryFilter(ballot.filters.Voted(null, null, null, null));

            checkVoteEvent(events[0], hash, voter1.address, 10 * 10 ** 6, true);
            checkVoteEvent(events[1], hash, voter1.address, 10 * 10 ** 6, true);
            checkVoteEvent(events[2], hash, voter1.address, 5 * 10 ** 6, false);

            const [forVotes, againstVotes] = await ballot.getProposalVotes(hash);
            expect(forVotes).to.equal(20 * 10 ** 6);
            expect(againstVotes).to.equal(5 * 10 ** 6);
        });

        it("Should be able to vote if proposal is approved", async function () {
            const {ballot, voter1, voter2, voter3} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await ballot.connect(voter1).createProposal(hash);

            await ballot.connect(voter1).vote(hash, 25 * 10 ** 6, true);
            await ballot.connect(voter2).vote(hash, 40 * 10 ** 6, true);

            const [forVotes, againstVotes] = await ballot.getProposalVotes(hash);
            expect(forVotes).to.equal(65 * 10 ** 6);
            expect(againstVotes).to.equal(0);

            expect(ballot.connect(voter3).vote(hash, 35 * 10 ** 6, true)).to.not.be.revertedWith("Proposal is not active");
        });

        it("Should not be able to vote after delegation", async function () {
            const {ballot, votingToken, voter1, voter4} = await loadFixture(deployBallotWithBalancesFixture);

            await votingToken.connect(voter1).delegate(voter4.address);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 4"));
            await ballot.connect(voter1).createProposal(hash);

            await expect(ballot.connect(voter1).vote(hash, 10 * 10 ** 6, true)).to.be.revertedWith("Not enough balance");
        });

        it("Shouldn't be able to vote if delegate start after proposal", async function () {
            const {ballot, votingToken, voter1, voter2, voter4} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await ballot.connect(voter1).createProposal(hash);

            await votingToken.connect(voter1).delegate(voter4.address);
            await votingToken.connect(voter2).delegate(voter4.address);

            await expect(ballot.connect(voter4).vote(hash, 30 * 10 ** 6, true)).to.be.revertedWith("Not enough balance");
        });

        it("Should be able to delegate all votes to another address", async function () {
            const {ballot, votingToken, voter1, voter2, voter3, voter4} = await loadFixture(deployBallotWithBalancesFixture);

            await votingToken.connect(voter1).delegate(voter4.address);
            await votingToken.connect(voter2).delegate(voter4.address);
            await votingToken.connect(voter3).delegate(voter4.address);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await ballot.connect(voter1).createProposal(hash);

            await ballot.connect(voter4).vote(hash, 100 * 10 ** 6, true);

            const [event] = await ballot.queryFilter(ballot.filters.Voted(null, null, null, null));
            checkVoteEvent(event, hash, voter4.address, 100 * 10 ** 6, true);

            const [forVotes, againstVotes] = await ballot.getProposalVotes(hash);
            expect(forVotes).to.equal(100 * 10 ** 6);
            expect(againstVotes).to.equal(0);
        });

        it("Should be able to get vote result if proposal has less than 50% of votes of total supply", async function () {
            const {ballot, voter1, voter2, voter3} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Some proposal"));
            await ballot.connect(voter1).createProposal(hash);

            await ballot.connect(voter1).vote(hash, 15 * 10 ** 6, true);
            await ballot.connect(voter2).vote(hash, 40 * 10 ** 6, false);
            await ballot.connect(voter3).vote(hash, 25 * 10 ** 6, true);

            const [forVotes, againstVotes] = await ballot.getProposalVotes(hash);
            expect(forVotes).to.equal(40 * 10 ** 6);
            expect(againstVotes).to.equal(40 * 10 ** 6);
        });

        it("Should emit event when quorum is reached and proposal rejected", async function () {
            const {ballot, voter1, voter2, voter3} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Rejected proposal"));
            await ballot.connect(voter1).createProposal(hash);

            await ballot.connect(voter1).vote(hash, 20 * 10 ** 6, false);
            await ballot.connect(voter2).vote(hash, 15 * 10 ** 6, false);
            await ballot.connect(voter3).vote(hash, 35 * 10 ** 6, false);

            const [event] = await ballot.queryFilter(ballot.filters.ProposalStatusChanged(null, null, null));

            expect(event.args.proposalId).to.equal(hash);
            expect(event.args.status).to.equal(3);
            expect(event.args.votes.forVotes).to.equal(0);
            expect(event.args.votes.againstVotes).to.equal(70 * 10 ** 6);
        });

        it("Should finish proposal if accept quorum is reached", async function () {
            const {ballot, voter1, voter2, voter3} = await loadFixture(deployBallotWithBalancesFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Accepted proposal"));
            await ballot.connect(voter1).createProposal(hash);

            await ballot.connect(voter1).vote(hash, 20 * 10 ** 6, true);
            await ballot.connect(voter2).vote(hash, 15 * 10 ** 6, true);
            await ballot.connect(voter3).vote(hash, 35 * 10 ** 6, true);

            const [event] = await ballot.queryFilter(ballot.filters.ProposalStatusChanged(null, null, null));

            expect(event.args.proposalId).to.equal(hash);
            expect(event.args.status).to.equal(2);
            expect(event.args.votes.forVotes).to.equal(70 * 10 ** 6);
            expect(event.args.votes.againstVotes).to.equal(0);
        });
    });
});

