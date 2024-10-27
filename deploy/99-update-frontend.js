const { ethers, network } = require("hardhat");
const fs = require("fs");

const FRONT_END_ADDRESSES_FILE =
  "../lottery-project-frontend/src/constants/addresses.json";
const FRONT_END_ABI_FILE = "../lottery-project-frontend/src/constants/abi.json";
module.exports = async () => {
  if (process.env.UPDATE_FRONTEND) {
    console.log("Updating Frontend...");
    updateContractAddresses();
    updateAbi();
  }
};

const updateAbi = async () => {
  const lottery = await ethers.getContract("Lottery");
  fs.writeFileSync(FRONT_END_ABI_FILE, lottery.interface.formatJson());
};

const updateContractAddresses = async () => {
  const lottery = await ethers.getContract("Lottery");
  const chainId = network.config.chainId.toString();
  const currentAddresses = JSON.parse(
    fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8")
  );
  if (
    chainId in currentAddresses &&
    !currentAddresses[chainId].includes(lottery.target)
  ) {
    currentAddresses[chainId].push(lottery.target);
  }
  {
    currentAddresses[chainId] = [lottery.target];
  }
  fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
};

module.exports.tags = ["all", "frontend"];
