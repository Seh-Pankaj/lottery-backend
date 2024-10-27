const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    console.log("Local network detected...");
    console.log("Deployer : " + deployer);
    const VRFCoordinatorV2Mock = await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    });
    const VRFCoordinatorAddress = VRFCoordinatorV2Mock.address;
    console.log("Mocks deployed at : " + VRFCoordinatorAddress);
    console.log("_____________________________________________");
  }
};

module.exports.tags = ["all", "mocks"];
