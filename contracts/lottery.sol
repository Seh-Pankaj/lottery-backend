// 1. Enter the lottery -> Invest some amount
// 2. Pick a random winner -> verifiably random
// 3. Winner to be selected every X minutes
// 4. Chainlink Oracle -> for random number
// 5. Chainlink Keepers for automated execution

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/KeeperCompatibleInterface.sol";

/* Errors */
error Lottery__NotEnoughETHEntered();
error Lottery__WithdrawCallFailed();
error Lottery__Closed();
error Lottery__noUpkeepNeeded(
    uint256 currBalance,
    uint256 players,
    uint256 lotteryState
);

/**
 * @title A Decentralized lottery contract
 * @author Pankaj Sehrawat
 * @notice This contract is a decentralized untamperable lottery smart contract
 * @dev This implements chainlink V2 and chainlink keepers
 */

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type Declarations */
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint8 private constant NUM_WORDS = 1;
    uint8 private constant REQUEST_CONFIRMATIONS = 3;

    /* Lottery Variables */
    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private immutable i_interval;
    uint256 private s_lastTimeStamp;

    /* Events */
    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 keyHash,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        i_interval = interval;
        s_lastTimeStamp = block.timestamp;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) revert Lottery__NotEnoughETHEntered();
        if (s_lotteryState != LotteryState.OPEN) revert Lottery__Closed();
        s_players.push(payable(msg.sender));

        // Emit an event every time players array is updated
        emit LotteryEnter(msg.sender);
    }

    /**
     * @dev This is the function that the chainlink keepers call
     * they look for the `upkeepNeeded` to return true.
     * The following should be true for this function to return true:
     * 1. The time interval for selecting winner should have passed.
     * 2. The lottery should have atleast one player and some ETH.
     * 3. Our subscription is funded with LINK.
     * 4. The lottery should be in an `open` state.
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeep, bytes memory /* performData */)
    {
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeep = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        // Request random number
        // Chainlink VRF is a 2 txn process
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__noUpkeepNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        (bool callSucess, ) = recentWinner.call{value: address(this).balance}(
            ""
        );
        // require(callSucess, "Withdraw call failed");
        if (!callSucess) {
            revert Lottery__WithdrawCallFailed();
        }
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        emit WinnerPicked(recentWinner);
    }

    /* View / Pure functions */
    function getEntryFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint8 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getNumWords() public pure returns (uint8) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimestamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getBlockTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    function getRequestConfirmations() public pure returns (uint8) {
        return REQUEST_CONFIRMATIONS;
    }
}
