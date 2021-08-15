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

    // Tracks the total XHT stake in the contract.
    uint256 public totalStake = 0;

    // Tracks the total weighted XHT stake in the contract. The weights`are based on periods.
    uint256 public totalStakeWeight = 0;

    // map of the addresses with the stakes its holding.
    mapping (address => Stake[]) private stakes;

    // array of staked addresses
    address[] public addressIndices;

    // stake duration for 2 days, 1 month, 1 year based on ethereum block
    uint256[] public periods = [13000, 195000, 2372500];

    // penalty for early removal of stake in percentage. default value is 10%
    uint256 public penalty = 10;

    event Reward(address _address, uint256 _reward);
    event Distribute(uint256 _amount);

    constructor(Token _token) {
        // It should be set during deployment with XHT token contract address.
        token = _token;
    }

    function getStake(address _staker) public view returns (Stake[] memory) {
        return (stakes[_staker]);
    }

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

        return (s.amount, s.period, s.startBlock, s.reward);
    }

    function removeStake(uint256 _index) public returns (uint256, uint256, uint256, uint256, uint256) {

        require(stakes[msg.sender].length > 0, "There should be at least one existing stake to remove from.");

        Stake memory s = stakes[msg.sender][_index];
        require(s.amount > 0 , "Selected stake amount shoud be more than zero.");

        uint256 receivedAmount = s.amount;
        uint256 penaltyAmount = 0;
        if (s.startBlock.add(s.period) > block.number) {
            // add 10% penalty for early removal and no allocation of rewards
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

        return (0, s.period, s.startBlock, 0, block.number);
    }

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
                    emit Reward(addressIndices[i], stakes[addressIndices[i]][j].reward);
                }
            }
        }
        emit Distribute(potBalance);
        return true;
    }

    function setPotAddress(address _address) public onlyOwner returns (address) {
        pot = _address;
        return pot;
    }

    function setPenalty(uint256 _penalty) public onlyOwner returns (uint256) {
        penalty = _penalty;
        return penalty;
    }

    function setPeriods(uint256[] memory _periods) public onlyOwner returns (uint256[] memory) {
        periods = _periods;
        return periods;
    }

    function setStake(uint256 _amount, uint256 _period, address _address) public onlyOwner returns (uint256, uint256, uint256, uint256) {
        require(_amount > 0 , "The amount should be more than zero");
        require(_amount >= 10**18 , "The amount should be larger than 1 XHT");
        require(_period > 0 , "Block period should be more than zero");
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

        Stake memory s = Stake(_amount, _period, block.number, 0, 0);
        stakes[_address].push(s);
    
        totalStake = totalStake.add(_amount);
        totalStakeWeight = totalStakeWeight.add(getStakeWeight(_period).mul(_amount));

        return (s.amount, s.period, s.startBlock, s.reward);
    }
}