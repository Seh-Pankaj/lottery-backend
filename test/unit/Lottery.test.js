const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Unit Tests", async function () {
      let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = await ethers.provider.getSigner();
        await deployments.fixture("all");
        lottery = await ethers.getContract("Lottery", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        lotteryEntranceFee = await lottery.getEntryFee();
        interval = await lottery.getInterval();
      });

      describe("constructor", function () {
        it("initializes the lottery correctly", async function () {
          const lotteryState = await lottery.getLotteryState();
          assert.equal(lotteryState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("enterLottery", () => {
        it("reverts when you don't pay enough ETH", async () => {
          await expect(
            lottery.enterLottery({ value: 0 })
          ).to.be.revertedWithCustomError(
            lottery,
            "Lottery__NotEnoughETHEntered"
          );
        });

        it("records player when they enter", async function () {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          const playerFromContract = await lottery.getPlayer(0);
          assert.equal(playerFromContract, deployer.address);
        });

        it("emits event on enter", async () => {
          await expect(
            lottery.enterLottery({ value: lotteryEntranceFee })
          ).to.emit(lottery, "LotteryEnter");
        });

        it("does not allow when lottery state is calculating", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await ethers.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await ethers.provider.send("evm_mine", []);
          await lottery.performUpkeep("0x");
          await expect(
            lottery.enterLottery({ value: lotteryEntranceFee })
          ).to.be.revertedWithCustomError(lottery, "Lottery__Closed");
        });
      });

      describe("checkUpkeep", () => {
        it("returns false if people don't send enought eth", async () => {
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeep } = await lottery.checkUpkeep("0x");
          assert(!upkeep);
        });

        it("returns false if lottery isn't open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await lottery.performUpkeep("0x");
          const lotteryState = await lottery.getLotteryState();
          assert(lotteryState, "1");
        });

        it("returns false if enough time hasn't passed", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) - 20,
          ]); // use a higher number here if this test fails
          await network.provider.send("evm_mine", []);
          const { upkeep } = await lottery.checkUpkeep.staticCallResult("0x"); // upkeep = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeep);
        });
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeep } = await lottery.checkUpkeep.staticCall("0x"); // upkeep = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeep);
        });
      });

      describe("performUpkeep", () => {
        it("it can only run if checkupkeep is true", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txn = await lottery.performUpkeep("0x");
          assert(txn);
        });

        it("reverts when checkupKeep is false", async () => {
          await expect(
            lottery.performUpkeep("0x")
          ).to.be.revertedWithCustomError(lottery, "Lottery__noUpkeepNeeded");
        });

        it("updates the lottery state, emits an event and calls the vrfcoordinator", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txnResponse = await lottery.performUpkeep("0x");
          const txnReceipt = await txnResponse.wait(1);
          const requestId = txnReceipt.logs[1].args.requestId;
          const lotteryState = await lottery.getLotteryState();
          assert(Number(requestId) > 0);
          assert(Number(lotteryState) === 1);
        });
      });

      describe("fulfillRandomWords", () => {
        beforeEach(async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });

        it("can only be called after performUpkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(
              0,
              await lottery.getAddress()
            )
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(
              1,
              await lottery.getAddress()
            )
          ).to.be.revertedWith("nonexistent request");
        });

        it("picks up a winner, resets the lottery and sends money", async () => {
          const additionalEntrants = 3;
          const startingAccountIndex = 1; // deployer = 0
          const accounts = await ethers.getSigners();
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalEntrants;
            i++
          ) {
            const accountConnectedLottery = lottery.connect(accounts[i]);
            await accountConnectedLottery.enterLottery({
              value: lotteryEntranceFee,
            });
          }
          const lastTimestamp = await lottery.getLatestTimestamp();
          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              try {
                const recentWinner = await lottery.getRecentWinner();
                const winnerEndingBalance = await ethers.provider.getBalance(
                  accounts[1].address
                );
                const numberOfPlayers = await lottery.getNumberOfPlayers();
                const endingTimestamp = await lottery.getLatestTimestamp();
                const lotteryState = await lottery.getLotteryState();
                assert.equal(Number(numberOfPlayers), 0);
                assert(endingTimestamp - lastTimestamp > interval);
                assert(lotteryState.toString(), "0");
                assert.equal(
                  winnerEndingBalance.toString(),
                  (
                    winnerStartingBalance +
                    (lotteryEntranceFee * BigInt(additionalEntrants) +
                      lotteryEntranceFee)
                  ).toString()
                );
              } catch (error) {
                reject(error);
              }
              resolve();
            });

            const winnerStartingBalance = await ethers.provider.getBalance(
              accounts[1].address
            );
            const txnResponse = await lottery.performUpkeep("0x");
            const txnReceipt = await txnResponse.wait(1);
            const reqId = txnReceipt.logs[1].args.requestId;
            const consumerAddr = await lottery.getAddress();
            await vrfCoordinatorV2Mock.fulfillRandomWords(reqId, consumerAddr);
          });
        });
      });
    });
