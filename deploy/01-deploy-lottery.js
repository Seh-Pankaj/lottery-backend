const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");

const { verify } = require("../utils/verfiy.js");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2Address,
    subscriptionId,
    subscriptionAmount = ethers.parseEther("30"),
    vrfCoordinatorV2Mock;

  if (developmentChains.includes(network.name)) {
    vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock",
      deployer
    );
    vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress();
    const txnResponse = await vrfCoordinatorV2Mock.createSubscription();
    const txnReceipt = await txnResponse.wait(1);
    subscriptionId = txnReceipt.logs[0].args[0];

    // Fund the subscription
    await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      subscriptionAmount
    );
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }
  console.log("Subscription funded");

  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];
  const args = [
    vrfCoordinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.waitConfirmations || 1,
    value: 0,
  });

  const lotteryAddress = lottery.address;
  console.log("Lottery contract deployed at : " + lotteryAddress);

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API)
    await verify(lottery.address, args);
  // Adding consumer so we can call vrf functions
  else await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lotteryAddress);
  console.log("_____________________________________________");
};

module.exports.tags = ["all", "lottery"];
