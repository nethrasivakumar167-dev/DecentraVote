
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Voting {
    uint public pollCount;

    uint public constant MIN_OPTIONS = 2;
    uint public constant MAX_OPTIONS = 10;
    uint public constant MAX_QUESTION_LENGTH = 200;
    uint public constant MAX_OPTION_LENGTH = 80;
    uint public constant MIN_DURATION = 60;
    uint public constant MAX_DURATION = 30 days;

    struct Poll {
        uint id;
        string question;
        string[] options;
        uint[] voteCounts;
        uint endTime;
        address creator;
        bool exists;
    }

    mapping(uint => Poll) private polls;
    mapping(address => uint[]) private creatorPolls;
    mapping(uint => mapping(address => bool)) public hasVoted;

    event PollCreated(
        uint indexed pollId,
        string question,
        address indexed creator,
        uint endTime
    );

    event VoteCast(
        uint indexed pollId,
        uint indexed optionIndex,
        address indexed voter
    );

    function createPoll(
        string memory _question,
        string[] memory _options,
        uint _duration
    ) public {
        require(bytes(_question).length > 0, "Question cannot be empty");
        require(
            _hasNonWhitespace(bytes(_question)),
            "Question cannot be whitespace only"
        );
        require(
            bytes(_question).length <= MAX_QUESTION_LENGTH,
            "Question too long"
        );

        require(_options.length >= MIN_OPTIONS, "At least 2 options required");
        require(_options.length <= MAX_OPTIONS, "Maximum 10 options allowed");

        require(_duration >= MIN_DURATION, "Duration too short");
        require(_duration <= MAX_DURATION, "Duration too long");

        pollCount++;

        Poll storage newPoll = polls[pollCount];

        newPoll.id = pollCount;
        newPoll.question = _question;
        newPoll.endTime = block.timestamp + _duration;
        newPoll.creator = msg.sender;
        newPoll.exists = true;

        creatorPolls[msg.sender].push(pollCount);

        for (uint i = 0; i < _options.length; i++) {
            require(
                bytes(_options[i]).length > 0,
                "Option cannot be empty"
            );
            require(
                _hasNonWhitespace(bytes(_options[i])),
                "Option cannot be whitespace only"
            );
            require(
                bytes(_options[i]).length <= MAX_OPTION_LENGTH,
                "Option too long"
            );

            for (uint j = 0; j < i; j++) {
                require(
                    keccak256(bytes(_options[i])) !=
                    keccak256(bytes(_options[j])),
                    "Duplicate option"
                );
            }

            newPoll.options.push(_options[i]);
            newPoll.voteCounts.push(0);
        }

        emit PollCreated(
            pollCount,
            _question,
            msg.sender,
            newPoll.endTime
        );
    }

    function vote(uint _pollId, uint _optionIndex) public {
        Poll storage currentPoll = polls[_pollId];

        require(currentPoll.exists, "Poll does not exist");
        require(block.timestamp < currentPoll.endTime, "Poll has ended");
        require(!hasVoted[_pollId][msg.sender], "Already voted");
        require(
            _optionIndex < currentPoll.options.length,
            "Invalid option"
        );

        hasVoted[_pollId][msg.sender] = true;
        currentPoll.voteCounts[_optionIndex]++;

        emit VoteCast(_pollId, _optionIndex, msg.sender);
    }

    function getPoll(uint _pollId) public view returns (
        uint id,
        string memory question,
        string[] memory options,
        uint[] memory voteCounts,
        uint endTime,
        address creator
    ) {
        Poll storage currentPoll = polls[_pollId];

        require(currentPoll.exists, "Poll does not exist");

        return (
            currentPoll.id,
            currentPoll.question,
            currentPoll.options,
            currentPoll.voteCounts,
            currentPoll.endTime,
            currentPoll.creator
        );
    }

    function getTotalVotes(uint _pollId) public view returns (uint total) {
        Poll storage currentPoll = polls[_pollId];

        require(currentPoll.exists, "Poll does not exist");

        for (uint i = 0; i < currentPoll.voteCounts.length; i++) {
            total += currentPoll.voteCounts[i];
        }
    }

    function getCreatorPolls(
        address _creator
    ) public view returns (uint[] memory) {
        return creatorPolls[_creator];
    }

    function _hasNonWhitespace(bytes memory _text)
        private
        pure
        returns (bool)
    {
        for (uint i = 0; i < _text.length; i++) {
            bytes1 character = _text[i];

            if (
                character != 0x20 &&
                (character < 0x09 || character > 0x0D)
            ) {
                return true;
            }
        }

        return false;
    }
}
