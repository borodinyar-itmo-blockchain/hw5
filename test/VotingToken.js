const {loadFixture} = require("@nomicfoundation/hardhat-network-helpers");

const {ethers} = require("hardhat");
const {expect} = require("chai");

describe("VotingToken", function () {
    async function deployVotingTokenFixture() {
        const [deployer] = await ethers.getSigners();

        const VotingToken = await ethers.getContractFactory("VotingToken");
        const votingToken = await VotingToken.deploy();

        console.log("\tVotingToken deployed to:", votingToken.address);

        return {
            deployer,
            votingToken
        };
    }

    describe("Deployment", function () {
        it("Should deploy the VotingToken contract", async function () {
            const {votingToken} = await loadFixture(deployVotingTokenFixture);

            expect(votingToken.address).to.properAddress;
        });


        it("Should set the name of the VotingToken contract", async function () {
            const {votingToken} = await loadFixture(deployVotingTokenFixture);

            expect(await votingToken.name()).to.equal("Voting Token");
        });

        it("Should set the symbol of the VotingToken contract", async function () {
            const {votingToken} = await loadFixture(deployVotingTokenFixture);

            expect(await votingToken.symbol()).to.equal("VOT");
        });

        it("Should set the decimals of the VotingToken contract", async function () {
            const {votingToken} = await loadFixture(deployVotingTokenFixture);

            expect(await votingToken.decimals()).to.equal(6);
        });

        it("Should set the total supply of the VotingToken contract", async function () {
            const {votingToken} = await loadFixture(deployVotingTokenFixture);

            expect(await votingToken.totalSupply()).to.equal(100000000);
        });

        it("Should set the balance of the VotingToken contract", async function () {
            const {votingToken} = await loadFixture(deployVotingTokenFixture);

            expect(await votingToken.balanceOf(votingToken.address)).to.equal(0);
        });
    });

    describe("Transfer", function () {
        it("Should transfer tokens from the owner to another address", async function () {
            const {deployer, votingToken} = await loadFixture(deployVotingTokenFixture);

            const amount = 1000;

            const [_, receiver] = await ethers.getSigners();

            const tx = await votingToken.transfer(receiver.address, amount);

            const receipt = await tx.wait();

            expect(receipt.status).to.equal(1);

            expect(await votingToken.balanceOf(deployer.address)).to.equal(100000000 - amount);
            expect(await votingToken.balanceOf(receiver.address)).to.equal(amount);
        });

        it("Should fail to transfer tokens from the owner to another address if the owner does not have enough tokens", async function () {
            const {deployer, votingToken} = await loadFixture(deployVotingTokenFixture);

            const amount = 1000;

            const [_, receiver] = await ethers.getSigners();

            await expect(votingToken.connect(receiver).transfer(deployer.address, amount)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });
    });

    describe("Delegate", function () {
        it("Should delegate votes from the owner to another address", async function () {
            const {deployer, votingToken} = await loadFixture(deployVotingTokenFixture);

            const [_, delegatee] = await ethers.getSigners();

            await votingToken.connect(deployer).delegate(delegatee.address);

            expect(await votingToken.delegates(deployer.address)).to.equal(delegatee.address);
        });
    });

});
