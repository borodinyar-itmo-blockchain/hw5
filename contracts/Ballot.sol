// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract Ballot {
    // Constants
    uint256 constant public VOTING_DURATION = 3 days;
    uint8 constant public MAX_PROPOSALS = 3;

    // Structs
    enum ProposalStatus {
        Pending,
        Active,
        Accepted,
        Discarded,
        Expired
    }

    struct Votes {
        uint256 forVotes;
        uint256 againstVotes;
    }

    struct Proposal {
        ProposalStatus status;

        Votes votes;
        uint256 creationBlock;
        uint256 ttl;
    }

    struct Voter {
        uint256 weight;
        Votes vote;
    }

    // State variables
    mapping(address => mapping(bytes32 => Voter)) public voters;
    mapping(bytes32 => Proposal) public proposals;

    bytes32[MAX_PROPOSALS] public proposalsQueue;
    ERC20Votes public votingToken;

    event ProposalCreated(bytes32 indexed proposalId, address indexed creator, uint256 ttl);
    event Voted(bytes32 indexed proposalId, address indexed voter, uint256 weight, bool support);
    event ProposalStatusChanged(bytes32 indexed proposalId, ProposalStatus status, Votes votes);

    // Modifier
    modifier checkBalanceForVoting {
        require(
            votingToken.balanceOf(msg.sender) > 0,
            "Not enough balance"
        );
        _;
    }

    constructor(address _votingToken) {
        votingToken = ERC20Votes(_votingToken);
    }

    function createProposal(bytes32 proposalId) public checkBalanceForVoting {
        require(proposals[proposalId].status == ProposalStatus.Pending, "Proposal already exists");
        uint8 indexQueue = _findFreeSlot();

        require(indexQueue < MAX_PROPOSALS, "Maximum number of proposals reached");

        proposals[proposalId] = Proposal({
            status : ProposalStatus.Active,
            votes : Votes(0, 0),
            creationBlock : block.number,
            ttl : block.timestamp + VOTING_DURATION
        });

        proposalsQueue[indexQueue] = proposalId;

        emit ProposalCreated(proposalId, msg.sender, VOTING_DURATION);
    }

    function vote(bytes32 proposalId, uint256 weight, bool support) public {
        _updateProposalStatus(proposalId);

        Proposal storage proposal = proposals[proposalId];

        require(proposal.status == ProposalStatus.Active, "Proposal is not active");
        require(weight > 0, "Weight must be greater than 0");

        Voter storage sender = voters[msg.sender][proposalId];

        require(
            votingToken.getPastVotes(msg.sender, proposal.creationBlock) >= weight + sender.vote.againstVotes + sender.vote.forVotes,
            "Not enough balance"
        );

        if (support) {
            proposal.votes.forVotes += weight;
            sender.vote.forVotes += weight;
        } else {
            proposal.votes.againstVotes += weight;
            sender.vote.againstVotes += weight;
        }

        emit Voted(proposalId, msg.sender, weight, support);

        _updateProposalStatus(proposalId);

    }

    function _updateProposalStatus(bytes32 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalSupply = votingToken.getPastTotalSupply(proposal.creationBlock);
        uint256 quorum = totalSupply / 2;

        if (proposal.votes.forVotes > quorum) {
            proposal.status = ProposalStatus.Accepted;
        } else if (proposal.votes.againstVotes > quorum) {
            proposal.status = ProposalStatus.Discarded;
        } else if (block.timestamp > proposal.ttl) {
            proposal.status = ProposalStatus.Expired;
        } else {
            return;
        }

        emit ProposalStatusChanged(proposalId, proposal.status, proposal.votes);
    }

    function _findFreeSlot() internal returns (uint8) {
        for (uint8 i = 0; i < MAX_PROPOSALS; i++) {
            if (proposalsQueue[i] == bytes32(0)) {
                return i;
            }

            _updateProposalStatus(proposalsQueue[i]);

            if (proposals[proposalsQueue[i]].status != ProposalStatus.Active) {
                return i;
            }
        }
        return MAX_PROPOSALS;
    }

    // View functions

    /// @dev Returns the status of the proposal
    /// @param proposalId Proposal hashcode
    /// @return Proposal status
    function getProposalState(bytes32 proposalId) public view returns (ProposalStatus) {
        return proposals[proposalId].status;
    }

    /// @dev Returns for and against votes for a proposal
    /// @param proposalId Proposal hashcode
    /// @return Votes for and against
    function getProposalVotes(bytes32 proposalId) public view returns (uint256, uint256) {
        return (proposals[proposalId].votes.forVotes, proposals[proposalId].votes.againstVotes);
    }

    /// @dev Returns the time to live of the proposal
    /// @param proposalId Proposal hashcode
    /// @return proposal ttl
    function getProposalTtl(bytes32 proposalId) public view returns (uint256) {
        return proposals[proposalId].ttl;
    }

    /// @dev Returns existing proposals in contract queue including accepted, discarded and expired
    /// @return proposals array
    function getProposals() external view returns (Proposal[] memory) {
        Proposal[] memory result = new Proposal[](MAX_PROPOSALS);

        for (uint8 i = 0; i < MAX_PROPOSALS; i++) {
            result[i] = proposals[proposalsQueue[i]];
        }

        return result;
    }

    /// @dev Returns count of active proposals in contract queue
    /// @return count of active proposals
    function getActiveProposalsCount() public view returns (uint8) {
        uint8 count = 0;
        for (uint8 i = 0; i < MAX_PROPOSALS; i++) {
            if (proposalsQueue[i] != bytes32(0)
            && proposals[proposalsQueue[i]].status == ProposalStatus.Active
                && proposals[proposalsQueue[i]].ttl > block.timestamp) {

                count++;
            }
        }
        return count;
    }
}