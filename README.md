# hw5

## How to run tests
Run following commands:
```
npm inslall
npx hardhat test
```

## Example output:
```
> npx hardhat test


  Ballot
    Deployment
        Ballot deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
      √ Should deploy the Ballot contract (2801ms)
      √ Should set the VotingToken contract address
      √ Should set the proposal count to 0
      √ Should be right total supply
      √ Should be right balance of voters (48ms)
    Proposals
      √ Should create a proposal (125ms)
      √ Should not create a proposal if the proposal is not unique (119ms)
      √ Should not create a proposal if not enough balance
      √ Should not create a proposal if created maximum number of proposals (221ms)
      √ Should create a proposal if created maximum number of proposals and the oldest proposal is expired (205ms)
    Voting
      √ Should vote for a proposal (84ms)
      √ Should not vote if the proposal does not exist (40ms)
      √ Should not vote if the proposal is expired (68ms)
      √ Should not vote if balance is not enough (64ms)
      √ Should be able to vote multiple times if not all balance is used (154ms)
      √ Should be able to vote if proposal is approved (167ms)
      √ Should not be able to vote after delegation (123ms)
      √ Shouldn't be able to vote if delegate start after proposal (130ms)
      √ Should be able to delegate all votes to another address (158ms)
      √ Should be able to get vote result if proposal has less than 50% of votes of total supply (149ms)
      √ Should emit event when quorum is reached and proposal rejected (131ms)
      √ Should finish proposal if accept quorum is reached (129ms)

  VotingToken
    Deployment
        VotingToken deployed to: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
      √ Should deploy the VotingToken contract (121ms)
      √ Should set the name of the VotingToken contract
      √ Should set the symbol of the VotingToken contract
      √ Should set the decimals of the VotingToken contract
      √ Should set the total supply of the VotingToken contract
      √ Should set the balance of the VotingToken contract
    Transfer
      √ Should transfer tokens from the owner to another address
      √ Should fail to transfer tokens from the owner to another address if the owner does not have enough tokens (41ms)
    Delegate
      √ Should delegate votes from the owner to another address (46ms)


  31 passing (5s)

```
