// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract VotingToken is ERC20Votes {

    constructor() ERC20("Voting Token", "VOT") ERC20Permit("Voting Token") {
        _mint(msg.sender, 100 * 10 ** decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
