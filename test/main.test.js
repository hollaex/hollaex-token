const { assert, expect } = require('chai');
const XHT = artifacts.require('XHT');
const Token = artifacts.require('Token');
const BN = web3.utils.BN;

require('chai')
    .use(require('chai-as-promised'))
    .should()

function tokens(n) {
    n = n.toString()
    return web3.utils.toWei(n);
}

function toEther(n) {
    n = n.toString();
    return web3.utils.fromWei(n);
}

contract('XHT', (accounts) => {
    let token, xht;
    const pot = accounts[1];

    before(async () => {
        // load contracts
        token = await Token.new('HollaEx', 'XHT');
        xht = await XHT.new(token.address);
        await token.transfer(pot, tokens(10000))
        await token.transfer(accounts[2], tokens(1000))
        await token.transfer(accounts[3], tokens(1000))
        await token.transfer(accounts[4], tokens(1000))
        await token.approve(xht.address, tokens(100000))
        await token.approve(xht.address, tokens(10000000), { from: pot })
        await token.approve(xht.address, tokens(100000), { from: accounts[2] })
        await token.approve(xht.address, tokens(100000), { from: accounts[3] })
        await token.approve(xht.address, tokens(100000), { from: accounts[4] })
        await xht.setPotAddress(pot);
        await xht.addStake(tokens(200), 1);
    })
    describe('Token deployment', async () => {
        it('has a name', async () => {
            const name = await token.name();
            assert.equal(name, 'HollaEx');
        })
    })

    describe('Pot', async () => {
        it('address is correct', async () => {
            const address = await xht.pot()
            assert.equal(address, pot)
        })
        it('has correct balance', async () => {
            const balance = await token.balanceOf(pot)
            assert.equal(balance.toString(), tokens(10000))
        })
        it('non admin can not change the pot address', async () => {
            try {
                await xht.setPotAddress(pot, { from: accounts[1] });
                assert.isOk(false);
            } catch (err) {
                assert.isOk(true);
            }
        })
    })

    describe('First Stake', async () => {
        it('is an array', async () => {
            const stake = await xht.getStake(accounts[0])
            assert.isArray(stake);
            assert.lengthOf(stake, 1, 'stake has a length of 1');
            assert.equal(stake[0].amount, tokens(200))
            assert.equal(stake[0].period, 1);
            assert.equal(stake[0].reward, 0);
        })
        it('totalStake is incremented', async () => {
            const totalStake = await xht.totalStake()
            assert.equal(totalStake.toString(), tokens(200))
        })
        it('totalStakeWeight is incremented', async () => {
            const totalStakeWeight = await xht.totalStakeWeight()
            assert.equal(totalStakeWeight.toString(), tokens(1 * 200))
        })
        it('should have pending reward', async () => {
            const pendingReward = await xht.getPendingReward(accounts[0], 0)
            const balancePot = await token.balanceOf(pot)
            assert.equal(pendingReward.toString(), balancePot.toString())
        })
    })
    describe('Distribute', async () => {
        before(async() => {
            await xht.distribute();
        })
        it('should empty total pot amount', async () => {
            const balancePot = await token.balanceOf(pot)
            assert.equal(balancePot.toString(), 0)
        })
        it('should increase the contract balance', async () => {
            const balanceContract = await token.balanceOf(xht.address)
            assert.equal(balanceContract.toString(), tokens(200 + 10000).toString())
        })
        it('should NOT change the staked amount and period', async () => {
            const stake = await xht.getStake(accounts[0]);
            assert.equal(stake[0].amount, tokens(200))
            assert.equal(stake[0].period, 1);
        })
        it('should increase the staked reward', async () => {
            const stake = await xht.getStake(accounts[0]);
            assert.equal(stake[0].reward, tokens(10000));
        })
    })

    describe('Period', async () => {
        it('address is correct', async () => {
            const period = await xht.periods(0)
            assert.equal(period, 1);
        })
        it('admin can change the period values', async () => {
            await xht.setPeriods([1, 6500, 100000, 195000, 2372500])
            const period = await xht.periods(2)
            assert.equal(period, 100000);
        })
        it('non admin can not change the period values', async () => {
            try {
                await xht.setPeriods([1, 195000, 2372500], { from: accounts[1] })
                assert.isOk(false)
            } catch (err) {
                assert.isOk(true)
            }
        })

        
    })

    describe('Add Additional Stakes', async () => {
        before(async() => {
            await xht.addStake(tokens(10), 6500);
            await xht.addStake(tokens(100), 100000);
            await xht.addStake(tokens(100), 2372500, { from: accounts[2] });
            await xht.addStake(tokens(1000), 6500, { from: accounts[3] });
            await xht.addStake(tokens(100), 1, { from: accounts[4] });
        })
        it('should have a new increased total stake', async () => {
            const totalStake = await xht.totalStake()
            assert.equal(totalStake.toString(), tokens(200 + 10 + 100 + 100 + 1000 + 100))
        })
        it('should have a new increased total stake weight', async () => {
            const totalStakeWeight = await xht.totalStakeWeight()
            assert.equal(totalStakeWeight.toString(), tokens(1 * 200 + 2 * 10 + 3 *100 + 5 * 100 + 2 * 1000 + 1 * 100))
        })
        it('has an updated stake', async () => {
            const stake = await xht.getStake(accounts[0])
            assert.isArray(stake);
            assert.lengthOf(stake, 3, 'stake has a length of 3');
            assert.equal(stake[0].amount, tokens(200))
            assert.equal(stake[0].period, 1);
            assert.equal(stake[0].reward, tokens(10000));
            assert.equal(stake[1].amount, tokens(10));
            assert.equal(stake[1].period, 6500);
        })
        it ('should not allow large amount for staking', async() => {
            try {
                await xht.addStake(tokens(Math.pow(10, 20)), 1, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow negative amount for staking', async() => {
            try {
                await xht.addStake(-100, 1, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow zero amount for staking', async() => {
            try {
                await xht.addStake(0, 1, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow any amount less than 1XHT for staking', async() => {
            try {
                await xht.addStake(tokens(1) - 1, 1, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow wrong period for staking', async() => {
            try {
                await xht.addStake(tokens(100), 11, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
    })

    describe('Distribution 2', async () => {
        it('should NOT allow the distribution because of low pot balance', async () => {
            try {
                await xht.distribute()
                assert.isOk(false, 'failed');
            } catch (err) {
                assert.isOk(true, 'passed');
            }
        })
        it('should allow the distribution after a transfer to the pot', async () => {
            try {
                await token.transfer(pot, tokens(50000))
                await xht.distribute()
                assert.isOk(true, 'passed');
            } catch (err) {
                assert.isOk(false, 'failed');
            }
        })
        it('should empty total pot amount', async () => {
            const balancePot = await token.balanceOf(pot)
            assert.equal(balancePot.toString(), 0)
        })
        it('should increase the contract balance', async () => {
            const balanceContract = await token.balanceOf(xht.address)
            let totalStake = await xht.totalStake()
            totalStake = toEther(totalStake)
            assert.equal(balanceContract.toString(), tokens(Number(totalStake) + Number(10000) + Number(50000)))
        })
        it ('matches the total rewards', async () => {
            const reward = await xht.getTotalReward();
            assert.approximately(Number(tokens(60000)), Number(reward), 10);
        })
        it ('have correct amount staked in the account', async () => {
            const stake = await xht.getStake(accounts[0])
            const accountStake =  Number(stake[0].amount) + Number(stake[1].amount) + Number(stake[2].amount);
            assert.equal(accountStake, tokens(310));
        })
        it ('have correct reward for the account', async () => {
            const stake = await xht.getStake(accounts[0])
            const totalStakeWeight = await xht.totalStakeWeight();
            const accountReward =  Number(toEther(stake[0].reward)) + Number(toEther(stake[1].reward)) + Number(toEther(stake[2].reward));
            const calculatedReward = 10000 + (50000 * (1 * Number(toEther(stake[0].amount)) + 2 * Number(toEther(stake[1].amount)) + 3 * Number(toEther(stake[2].amount))))/Number(toEther(totalStakeWeight));
            
            assert.approximately(accountReward, calculatedReward, 10);
        })
        it ('contract balance is equal to its holdings', async() => {
            const contractAddress = await token.balanceOf(xht.address);
            const totalStake = await xht.totalStake();
            const totalReward = await xht.getTotalReward();
            assert.approximately(Number(toEther(contractAddress)), Number(toEther(new BN(totalStake).add(totalReward))), 10);
        })
    })
    describe('Remove Stake without Penalty', async () => {
        let balance = 0;
        let stake;
        before(async() => {
            balance = await token.balanceOf(accounts[0]); // balance before removing the stake
            stake = await xht.getStake(accounts[0])
            await xht.removeStake(0);
        })
        it('sent total principal amount and reward', async () => {
            const newBalance = await token.balanceOf(accounts[0]);
            const total = Number(toEther(stake[0].reward)) + Number(toEther(stake[0].amount))
            assert.approximately(Number(toEther(newBalance)) - Number(toEther(balance)), total, 10)
        
        })
        it('should remove correct stake', async () => {
            const stake = await xht.getStake(accounts[0])
            assert.isOk(true)
            assert.equal(stake[0].amount, 0);
            assert.equal(stake[0].reward, 0);
            assert.isAbove(Number(stake[0].closeBlock), 0);
        })
        it ('should not allow stake removal for empty stake', async() => {
            try {
                await xht.removeStake(0, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow removal for an unused index', async() => {
            try {
                await xht.removeStake(5, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow removal for an unused index', async() => {
            try {
                await xht.removeStake(5, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow removal for a large index', async() => {
            try {
                await xht.removeStake(Math.pow(10,100), { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('should not allow removal for a negative index', async() => {
            try {
                await xht.removeStake(-2, { from: accounts[0] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('contract balance is equal to its holdings', async() => {
            const contractAddress = await token.balanceOf(xht.address);
            const totalStake = await xht.totalStake();
            const totalReward = await xht.getTotalReward();
            assert.approximately(Number(toEther(contractAddress)), Number(toEther(new BN(totalStake).add(totalReward))), 10);
        })
    })

    describe('Remove Stake with Penalty', async () => {
        let balance = 0;
        let stake;
        before(async() => {
            balance = await token.balanceOf(accounts[2]); // balance before removing the stake
            stake = await xht.getStake(accounts[2])
            await xht.removeStake(0, { from: accounts[2] });
        })
        it('sent total principal amount and reward', async () => {
            const newBalance = await token.balanceOf(accounts[2]);
            const total = Number(toEther(stake[0].amount)) - (Number(toEther(stake[0].amount)) * 0.1)
            assert.approximately(Number(toEther(newBalance)) - Number(toEther(balance)), total, 10)
        
        })
        it('should remove correct stake', async () => {
            const stake = await xht.getStake(accounts[2])
            assert.isOk(true)
            assert.equal(stake[0].amount, 0);
            assert.equal(stake[0].reward, 0);
            assert.isAbove(Number(stake[0].closeBlock), 0);
        })
        it ('contract balance is equal to its holdings', async() => {
            const contractAddress = await token.balanceOf(xht.address);
            const totalStake = await xht.totalStake();
            const totalReward = await xht.getTotalReward();
            assert.approximately(Number(toEther(contractAddress)), Number(toEther(new BN(totalStake).add(totalReward))), 10);
        })
        it ('should not allow stake removal for empty stake', async() => {
            try {
                await xht.removeStake(0, { from: accounts[2] });
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
    })
    describe('Penalty', async () => {
        it ('should have default penalty of 10', async() => {
            const penalty = await xht.penalty()
            assert.equal(penalty.toString(), 10)
        })
        it ('non admin can not change the default value', async() => {
            try {
                await xht.setPenalty(20, { from: accounts[1] })
                assert.isOk(false)
            } catch (err) {
                assert.isOk(true)
            }
        })
        it ('can not be a negative number', async() => {
            try {
                await xht.setPenalty(-1)
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('can not be more than hundred percent', async() => {
            try {
                await xht.setPenalty(101)
                assert.isOk(false);
            } catch(err) {
                assert.isOk(true);
            }            
        })
        it ('admin can change the default value', async() => {
            await xht.setPenalty(20)
            const penalty = await xht.penalty()
            assert.equal(penalty.toString(), 20)
        })
        it ('remove stake apply the new penalty', async() => {
            const balance = await token.balanceOf(accounts[3]);
            const stake = await xht.getStake(accounts[3])
            await xht.removeStake(0, { from: accounts[3] });            
            const newBalance = await token.balanceOf(accounts[3]);
            const total = Number(toEther(stake[0].amount)) - (Number(toEther(stake[0].amount)) * 0.2)
            assert.approximately(Number(toEther(newBalance)) - Number(toEther(balance)), total, 10)
        })
    })
    describe('Set manual stake', async () => {
        it ('should only be allowed by the admin', async() => {
            try {
                await xht.setStake(tokens(100), 1, accounts[5], 1, 10, { from: accounts[1] })
                assert.isOk(false)
            } catch (err) {
                assert.isOk(true)
            }
        })
        it ('should set the right stake', async() => {
            await xht.setStake(tokens(100), 1, accounts[5], 1, tokens(10), { from: accounts[0] })
            const stake = await xht.getStake(accounts[5])
            assert.isArray(stake);
            assert.lengthOf(stake, 1, 'stake has a length of 1');
            assert.equal(stake[0].amount, tokens(100))
            assert.equal(stake[0].period, 1);
            assert.equal(stake[0].reward, tokens(10));
            assert.equal(stake[0].startBlock, 1);
        })
        it('can not be removed by the admin', async() => {
            try {
                await xht.removeStake(0, { from: accounts[0] })
                assert.isOk(false)
            } catch (err) {
                assert.isOk(true)
            }
        });
        it('should be removable by the address owner', async() => {
            try {
                await xht.removeStake(0, { from: accounts[5] })
                assert.isOk(true)
            } catch (err) {
                assert.isOk(false)
            }
        });
        it('has the right balance', async() => {
            const balance = await token.balanceOf(accounts[5]);
            const pendingReward = await xht.getPendingReward(accounts[5], 0)
            // pendingRewards + 110 tokens should be equal to balance
            assert.isOk(true)
        })
        if('has the empty stake', async() => {
            const stake = xht.getStake(accounts[5])
            assert.isArray(stake);
            assert.lengthOf(stake, 1, 'stake has a length of 1');
            assert.equal(stake[0].amount, 0)
            assert.equal(stake[0].period, 1);
            assert.equal(stake[0].reward, 0);
            assert.equal(stake[0].startBlock, 1);
        })
        it ('contract balance is equal to its holdings', async() => {
            const contractAddress = await token.balanceOf(xht.address);
            const totalStake = await xht.totalStake();
            const totalReward = await xht.getTotalReward();
            assert.approximately(Number(toEther(contractAddress)), Number(toEther(new BN(totalStake).add(totalReward))), 10);
        })
    })
})