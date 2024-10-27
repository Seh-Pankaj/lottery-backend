const { network, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Unit Tests", async function () {
      let lottery, lotteryEntranceFee, deployer;

      beforeEach(async function () {
        deployer = await ethers.provider.getSigner();
        lottery = await ethers.getContract("Lottery", deployer);
        lotteryEntranceFee = await lottery.getEntryFee();
      });

      describe("fulfillRandomWords", () => {
        it("picks up winner correctly with live chainlink VRF and keepers", async () => {
          console.log("Setting up test...");
          const startTimestamp = await lottery.getLatestTimestamp();
          const accounts = await ethers.getSigners();
          console.log("Setting up Listener...");
          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              try {
                const recentWinner = await lottery.getRecentWinner();
                const lotteryState = await lottery.getLotteryState();
                const endingBalance = await ethers.provider.getBalance(
                  accounts[0].address
                );
                const endingTimestamp = await lottery.getLatestTimestamp();
                await expect(lottery.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(lotteryState, 0);
                assert.equal(
                  endingBalance,
                  startingBalance + lotteryEntranceFee
                );
                assert(endingTimestamp > startTimestamp);
                resolve("Resolved");
              } catch (error) {
                reject(error);
              }
            });
            // enter lottery with only one player
            const txnReceipt = await lottery.enterLottery({
              value: lotteryEntranceFee,
            });
            await txnReceipt.wait(1);
            const startingBalance = await ethers.provider.getBalance(
              accounts[0].address
            );
            console.log("Ok, time to wait...");
          });
        });
      });
    });
