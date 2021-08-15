const XHT = artifacts.require("XHT");
const Token = artifacts.require("Token");

module.exports = async function(deployer) {
  await deployer.deploy(Token, 'HollaEx', 'XHT');
  const token = await Token.deployed();

  await deployer.deploy(XHT, token.address);
  const xht = await XHT.deployed()

};
