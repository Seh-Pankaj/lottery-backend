const { getUnnamedAccounts, network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = getUnnamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2Address;

  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress();
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
  }

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: network.config.waitConfirmations || 1,
  });
};
