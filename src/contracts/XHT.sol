pragma solidity ^0.8.0;

import "./Token.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract XHT is Ownable {

    using SafeMath for uint256;

    Token token;

    struct Stake {
        uint256 amount;
        uint256 period;
        uint256 startBlock;
        uint256 reward;
        uint256 closeBlock;
    }

    // Main contract pot address which is used for redistribution.
    // The total balance of this address is cleared every time distribute function is called.
    // Admin can change this address.
    address public pot = 0x0000000000000000000000000000000000000000;

    // Tracks the total active XHT stakes in the contract.
    uint256 public totalStake = 0;

    // Tracks the total active weighted XHT stake in the contract. The weights`are based on periods.
    uint256 public totalStakeWeight = 0;

    // map of the active addresses with the stakes its holding.
    mapping (address => Stake[]) private stakes;

    // array of active staked addresses
    address[] public addressIndices;

    // stake duration for 1 block, 1 day, 1 month, 1 year based on ethereum block
    uint256[] public periods = [1, 6500, 195000, 2372500];

    // penalty for early removal of stake in percentage. default value is 10%
    uint256 public penalty = 10;

    // The block number in which the contract is deployed.
    // This is used for stake migrations for a short period after the contract deployment.
    uint public deployedBlock = block.number;

    event RewardEvent(address _address, uint256 _reward);
    event DistributeEvent(uint256 _amount);
    event StakeEvent(address _address, uint256 _amount);
    event UnstakeEvent(address _address, uint256 _amount);

    constructor(Token _token) {
        // It should be set during deployment with XHT token contract address.
        token = _token;
    }
    
    /**
    * Returns specific stake data.
    *
    * @param {address} _staker The address of staker to retrieve stake data from.
    */
    function getStake(address _staker) public view returns (Stake[] memory) {
        return (stakes[_staker]);
    }

    /**
    * Returns weight of specific period. Determines the importance of the period in distribution calculation.
    *
    * @param {uint256} _period The specific period to get the weight for.
    */
    function getStakeWeight(uint256 _period) public view returns (uint256) {
        uint256 weight = 0;
        for (uint i=0; i<periods.length; i++) {
            if (periods[i] == _period) {
                // period index plus 1 is the weight of the period. The periods array order is important
                weight = i + 1;
            }
        }
        return weight;
    }

    /**
    * Returns total reward of all the active stakes.
    */
    function getTotalReward() public view returns (uint256) {
        uint256 reward = 0;
        
        for (uint i=0; i<addressIndices.length; i++) {
            for (uint j=0; j<stakes[addressIndices[i]].length; j++) {
                Stake memory s = stakes[addressIndices[i]][j];
                reward = reward.add(s.reward);
            }
        }
        return reward;
    }

    /**
    * Returns the pending reward thats not distributed.
    *
    * @param {address} _staker the address of the stake.
    * @param {uint256} _index index of the stake.
    */
    function getPendingReward(address _staker, uint256 _index) public view returns (uint256) {
        uint256 potBalance = token.balanceOf(pot);
        uint256 reward = 0;
        Stake memory s = stakes[_staker][_index];
        if (s.amount > 0) {
            uint256 weightedAmount = getStakeWeight(s.period).mul(s.amount);                     
            reward = weightedAmount.mul(potBalance).div(totalStakeWeight);
        }
        return reward;
    }

    /**
    * Returns stake data.
    *
    * @param {uint256} _amount The amount of XHT to be staked.
    * @param {uint256} _period The duration for stake.
    */
    function addStake(uint256 _amount, uint256 _period) public returns (uint256, uint256, uint256, uint256) {
        require(_amount > 0 , "The amount should be more than zero");
        require(_amount >= 10**18 , "The amount should be larger than 1 XHT");
        require(_period > 0 , "Block period should be more than zero");

        // Flag to check if the period set by the user is among the periods set in the contract.
        bool check = false;
        for (uint i=0; i<periods.length; i++) {
            if (periods[i] == _period) {
                check = true;
            }
        }
        require(check == true, "Period should follow one the pre set staking periods.");     

        token.transferFrom(msg.sender, address(this), _amount);

        if (stakes[msg.sender].length == 0) {
            // First time staking with this address
            addressIndices.push(msg.sender);
        }

        Stake memory s = Stake(_amount, _period, block.number, 0, 0);
        stakes[msg.sender].push(s);
    
        totalStake = totalStake.add(_amount);
        totalStakeWeight = totalStakeWeight.add(getStakeWeight(_period).mul(_amount));

        emit StakeEvent(msg.sender, _amount);
        return (s.amount, s.period, s.startBlock, s.reward);
    }

    /**
    * Returns the stake data.
    *
    * @param {uint256} _index Array index of the stake to be removed.
    */
    function removeStake(uint256 _index) public returns (uint256, uint256, uint256, uint256, uint256) {

        require(stakes[msg.sender].length > 0, "There should be at least one existing stake to remove from.");

        uint256 potBalance = token.balanceOf(pot);
        if (potBalance >= 10**22) {
            distribute();
        }

        Stake memory s = stakes[msg.sender][_index];
        require(s.amount > 0 , "Selected stake amount shoud be more than zero.");

        uint256 receivedAmount = s.amount;
        uint256 penaltyAmount = 0;
        if (s.startBlock.add(s.period) > block.number) {
            // Add 10% penalty for early removal and no allocation of rewards
            penaltyAmount = receivedAmount.mul(penalty).div(100);
            receivedAmount = receivedAmount.sub(penaltyAmount);
        } else {
            receivedAmount = receivedAmount.add(s.reward);
        }

        if (penaltyAmount > 0) {
            // Send the deducted penalty and reward back to the pot for redistribution
            penaltyAmount = penaltyAmount.add(s.reward);
            token.transfer(pot, penaltyAmount);
        }

        // Send the unstaked amount to the user
        token.transfer(msg.sender, receivedAmount);

        // Reset the stake
        stakes[msg.sender][_index] = Stake(0, s.period, s.startBlock, 0, block.number);

        totalStake = totalStake.sub(s.amount);
        totalStakeWeight = totalStakeWeight.sub(getStakeWeight(s.period).mul(s.amount));
        
        emit UnstakeEvent(msg.sender, receivedAmount);
        return (0, s.period, s.startBlock, 0, block.number);
    }

    /**
    * Returns true. Distribute the pot balance among stakers.
    */
    function distribute() public returns (bool) {
        uint256 potBalance = token.balanceOf(pot);
        require(potBalance >= 10**22, "There should be at least 10000 XHT in the pot for distribution.");

        token.transferFrom(pot, address(this), potBalance);

        for (uint i=0; i<addressIndices.length; i++) {
            for (uint j=0; j<stakes[addressIndices[i]].length; j++) {
                Stake memory s = stakes[addressIndices[i]][j];
                if (s.amount > 0) {
                    uint256 weightedAmount = getStakeWeight(s.period).mul(s.amount);                     
                    uint256 reward = weightedAmount.mul(potBalance).div(totalStakeWeight);
                    stakes[addressIndices[i]][j].reward = s.reward.add(reward);
                    emit RewardEvent(addressIndices[i], stakes[addressIndices[i]][j].reward);
                }
            }
        }
        emit DistributeEvent(potBalance);
        return true;
    }

    /**
    * Returns the new pot address. Can only be executed by the admin.
    *
    * @param {uint256} _address The new pot address.
    */
    function setPotAddress(address _address) public onlyOwner returns (address) {
        pot = _address;
        return pot;
    }

    /**
    * Returns the new pot address. It can only be executed by the admin.
    *
    * @param {uint256} _penalty The new penalty in percentage.
    */
    function setPenalty(uint256 _penalty) public onlyOwner returns (uint256) {
        require(_penalty <= 100, "penalty can not be more than hundred percent");
        require(_penalty >= 0, "penalty can not be a negative number");
        penalty = _penalty;
        return penalty;
    }

    /**
    * Returns the new periods. Can only be executed by the admin.
    *
    * @param {uint256} _periods An array of the new periods.
    */
    function setPeriods(uint256[] memory _periods) public onlyOwner returns (uint256[] memory) {
        periods = _periods;
        return periods;
    }

    /**
    * Manually sets a stake for an address. This us used for initial stake migration and can only be used by admin within within 195000 blocks (~30 days) from contract creation.
    * Returns stake data.
    *
    * @param {uint256} _amount The amount of XHT to be staked.
    * @param {uint256} _period The duration for stake.
    * @return {address} _address Address for the staker. When remove the stake the stake amount goes to this address.
    * @return {address} _startBlock The block this stake started. Used for migrating existing stakes initially.
    * @return {address} _reward The reward this stake has collected. Used for migrating existing stakes initially.
    */

    function setStake(uint256 _amount, uint256 _period, address _address, uint256 _startBlock, uint256 _reward) public onlyOwner returns (uint256, uint256, uint256, uint256) {
        require(_amount > 0 , "The amount should be more than zero.");
        require(_amount >= 10**18 , "The amount should be larger than 1 XHT.");
        require(_period > 0 , "Block period should be more than zero.");
        require(block.number < deployedBlock + 585000 , "Function expired. This function can only be used within 585000 blocks (~90 days) from contract creation.");

        bool check = false;
        for (uint i=0; i<periods.length; i++) {
            if (periods[i] == _period) {
                check = true;
            }
        }
        require(check == true, "Period should follow one the pre set staking periods.");     

        token.transferFrom(msg.sender, address(this), _amount);

        if (stakes[_address].length == 0) {
            // First time staking with this address
            addressIndices.push(_address);
        }

        Stake memory s = Stake(_amount, _period, _startBlock, _reward, 0);
        stakes[_address].push(s);
    
        totalStake = totalStake.add(_amount);
        totalStakeWeight = totalStakeWeight.add(getStakeWeight(_period).mul(_amount));

        emit StakeEvent(_address, _amount);
        return (s.amount, s.period, s.startBlock, s.reward);
    }
}