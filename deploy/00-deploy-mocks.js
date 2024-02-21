const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { Log } = require("ethers");

const BASE_FEE = ethers.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = getNamedAccounts();
  const chainId = network.config.chainId;
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    console.log("Local network detected...");
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    });
    console.log("Mocks deployed...");
    console.log("----------------------------------------");
    Log("hey there");
  }
};

module.exports.tags = ["all", "mocks"];
