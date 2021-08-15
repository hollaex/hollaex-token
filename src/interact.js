

const Web3 = require('web3');
const { abi } = require('./abis/XHT.json');
const Token = require('./abis/Token.json');

const PRIVATE_KEY1 = process.env.PRIVATE_KEY1; // contract creator (test)
const PRIVATE_KEY2 = process.env.PRIVATE_KEY2; //testnet
const INFURA_KEY = process.env.INFURA_KEY

const web3 = new Web3(new Web3.providers.HttpProvider(`https://ropsten.infura.io/v3/${INFURA_KEY}`))

const contract = new web3.eth.Contract(abi, '0xa324C864A04c88ABAB2dE0d291B96D3cD9a17153');

const tokenContract = new web3.eth.Contract(Token.abi, '0xf0D641A2f02cA52ec56d0791BC79f68da2C772A9');


const test = async () => {
    try {
        const pot = await contract.methods.pot().call();
        console.log('pot', pot.toString());
        const totalStake = await contract.methods.totalStake().call();
        console.log('totalStake', totalStake.toString());
        const totalStakeWeight = await contract.methods.totalStakeWeight().call();
        console.log('totalStakeWeight', totalStakeWeight.toString());
        const periods = await contract.methods.periods(0).call();
        console.log('periods', periods.toString());
        const penalty = await contract.methods.penalty().call();
        console.log('penalty', penalty.toString());
        const getTotalReward = await contract.methods.getTotalReward().call();
        console.log('getTotalReward', getTotalReward.toString());
        
    } catch (err) {
        console.log(err)
    }
}


const init = async () => {
    try {
        web3.eth.accounts.wallet.add(PRIVATE_KEY1)
        const account = web3.eth.accounts.wallet[0].address

        console.log(account)
        // const gasLimit = await contract.methods
        //     .distribute()
        //     .estimateGas({from: account})
        // console.log(gasLimit)

        const balance = await web3.eth.getBalance(account)
        console.log(balance)

        const gasPrice = await web3.eth.getGasPrice()
        console.log(gasPrice)


        const pot = await contract.methods
            .setPotAddress('0xDAEE11B4C79cFe8777623f3861aC117543679166')
            .send({
                from: account,
                gasPrice: web3.utils.toHex(gasPrice),
                gas: web3.utils.toHex(50000),
            });
        console.log('pot', pot.toString());
        
    } catch (err) {
        console.log(err)
    }
}

const stake = async () => {
    try {
        web3.eth.accounts.wallet.add(PRIVATE_KEY2)
        const account = web3.eth.accounts.wallet[0].address

        const gasPrice = await web3.eth.getGasPrice()
        // const gasLimit = await contract.methods
        //     .addStake(web3.utils.toWei('5000'), 1)
        //     .estimateGas({from: account})
        // console.log(gasLimit)
        contract.methods.addStake(web3.utils.toWei('2000'), 6500)
        .send({
            from: account,
            gasPrice: web3.utils.toHex(gasPrice),
            gas: web3.utils.toHex(300000),
        });

    } catch (err) {
        console.log(err)
    }
};

const removeStake = async () => {
    try {
        web3.eth.accounts.wallet.add(PRIVATE_KEY2)
        const account = web3.eth.accounts.wallet[0].address

        const gasPrice = await web3.eth.getGasPrice()
        // const gasLimit = await contract.methods
        //     .addStake(web3.utils.toWei('5000'), 1)
        //     .estimateGas({from: account})
        // console.log(gasLimit)
        contract.methods.removeStake(0)
        .send({
            from: account,
            gasPrice: web3.utils.toHex(gasPrice),
            gas: web3.utils.toHex(300000),
        });

    } catch (err) {
        console.log(err)
    }
};

const distribute = async () => {
    try {
        web3.eth.accounts.wallet.add(PRIVATE_KEY2)
        const account = web3.eth.accounts.wallet[0].address

        const gasPrice = await web3.eth.getGasPrice()
        // const gasLimit = await contract.methods
        //     .distribute()
        //     .estimateGas({ from: account })
        // console.log(gasLimit)
        contract.methods.distribute()
        .send({
            from: account,
            gasPrice: web3.utils.toHex(gasPrice),
            gas: web3.utils.toHex(300000),
        });

    } catch (err) {
        console.log(err)
    }
};

const approve = async () => {
    web3.eth.accounts.wallet.add(PRIVATE_KEY1)
    const account = web3.eth.accounts.wallet[0].address
    const gasPrice = await web3.eth.getGasPrice()
    tokenContract.methods.approve('0xa324C864A04c88ABAB2dE0d291B96D3cD9a17153', web3.utils.toWei('1000000'))
        .send({
            from: account,
            gasPrice: web3.utils.toHex(gasPrice),
            gas: web3.utils.toHex(50000),
        })
}

test()
// init()
// stake()
// approve()
// distribute()
// removeStake()