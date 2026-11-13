
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting", function () {
    let voting;
    let owner;
    let voter1;
    let voter2;

    beforeEach(async function () {
        [owner, voter1, voter2] = await ethers.getSigners();

        const Voting = await ethers.getContractFactory("Voting");
        voting = await Voting.deploy();
        await voting.waitForDeployment();
    });

    describe("Poll Creation", function () {
        it("Should create a poll successfully", async function () {
            await voting.createPoll(
                "Who is your favourite superhero?",
                ["Iron Man", "Thor", "Captain America"],
                3600
            );

            expect(await voting.pollCount()).to.equal(1);

            const poll = await voting.getPoll(1);

            expect(poll.question).to.equal(
                "Who is your favourite superhero?"
            );
            expect(poll.options).to.deep.equal([
                "Iron Man",
                "Thor",
                "Captain America"
            ]);
            expect(poll.creator).to.equal(owner.address);
        });

        it("Should reject a poll with fewer than two options", async function () {
            await expect(
                voting.createPoll("Choose one", ["Option A"], 3600)
            ).to.be.revertedWith("At least 2 options required");
        });

        it("Should reject an empty question", async function () {
            await expect(
                voting.createPoll("", ["Yes", "No"], 3600)
            ).to.be.revertedWith("Question cannot be empty");
        });


        it("Should reject a whitespace-only question", async function () {
            await expect(
                voting.createPoll("   ", ["Yes", "No"], 3600)
            ).to.be.revertedWith("Question cannot be whitespace only");
        });

        it("Should reject a whitespace-only option", async function () {
            await expect(
                voting.createPoll("Choose one", ["Yes", "   "], 3600)
            ).to.be.revertedWith("Option cannot be whitespace only");
        });


        it("Should reject a question longer than 200 characters", async function () {
            const longQuestion = "A".repeat(201);

            await expect(
                voting.createPoll(longQuestion, ["Yes", "No"], 3600)
            ).to.be.revertedWith("Question too long");
        });

        it("Should reject more than 10 options", async function () {
            const options = Array.from(
                { length: 11 },
                (_, i) => `Option ${i + 1}`
            );

            await expect(
                voting.createPoll("Choose one", options, 3600)
            ).to.be.revertedWith("Maximum 10 options allowed");
        });

        it("Should reject an option longer than 80 characters", async function () {
            const longOption = "A".repeat(81);

            await expect(
                voting.createPoll("Choose one", [longOption, "No"], 3600)
            ).to.be.revertedWith("Option too long");
        });

        it("Should reject duplicate options", async function () {
            await expect(
                voting.createPoll("Choose one", ["Yes", "Yes"], 3600)
            ).to.be.revertedWith("Duplicate option");
        });

        it("Should reject a duration shorter than 60 seconds", async function () {
            await expect(
                voting.createPoll("Choose one", ["Yes", "No"], 59)
            ).to.be.revertedWith("Duration too short");
        });

        it("Should reject a duration longer than 30 days", async function () {
            await expect(
                voting.createPoll(
                    "Choose one",
                    ["Yes", "No"],
                    30 * 24 * 60 * 60 + 1
                )
            ).to.be.revertedWith("Duration too long");
        });


        it("Should accept valid maximum limits", async function () {
            const options = Array.from(
                { length: 10 },
                (_, i) => `Option ${i + 1}`
            );

            const question = "Q".repeat(200);
            const longOption = "A".repeat(80);

            await voting.createPoll(
                question,
                [longOption, ...options.slice(1)],
                60
            );

            const poll = await voting.getPoll(1);

            expect(poll.question).to.equal(question);
            expect(poll.options.length).to.equal(10);
            expect(poll.options[0]).to.equal(longOption);
        });

    });

    describe("Voting", function () {
        beforeEach(async function () {
            await voting.createPoll(
                "Who is your favourite superhero?",
                ["Iron Man", "Thor", "Captain America"],
                3600
            );
        });

        it("Should allow a wallet to vote", async function () {
            await voting.connect(voter1).vote(1, 0);

            const poll = await voting.getPoll(1);

            expect(poll.voteCounts[0]).to.equal(1);
            expect(await voting.hasVoted(1, voter1.address)).to.equal(true);
        });

        it("Should prevent a wallet from voting twice", async function () {
            await voting.connect(voter1).vote(1, 0);

            await expect(
                voting.connect(voter1).vote(1, 1)
            ).to.be.revertedWith("Already voted");
        });

        it("Should allow different wallets to vote", async function () {
            await voting.connect(voter1).vote(1, 0);
            await voting.connect(voter2).vote(1, 1);

            const poll = await voting.getPoll(1);

            expect(poll.voteCounts[0]).to.equal(1);
            expect(poll.voteCounts[1]).to.equal(1);
        });

        it("Should reject an invalid option index", async function () {
            await expect(
                voting.connect(voter1).vote(1, 5)
            ).to.be.revertedWith("Invalid option");
        });

        it("Should reject voting on a non-existent poll", async function () {
            await expect(
                voting.connect(voter1).vote(99, 0)
            ).to.be.revertedWith("Poll does not exist");
        });
    });

    describe("Poll Deadline", function () {
        it("Should reject voting after the deadline", async function () {
            await voting.createPoll(
                "Test poll",
                ["Yes", "No"],
                60
            );

            await ethers.provider.send("evm_increaseTime", [61]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                voting.connect(voter1).vote(1, 0)
            ).to.be.revertedWith("Poll has ended");
        });
    });

    describe("Poll Statistics and Creator", function () {

        it("Should return zero votes for a new poll", async function () {
            await voting.createPoll(
                "Favourite language?",
                ["JavaScript", "Python"],
                3600
            );

            expect(await voting.getTotalVotes(1)).to.equal(0);
        });

        it("Should calculate the total votes correctly", async function () {
            await voting.createPoll(
                "Favourite language?",
                ["JavaScript", "Python"],
                3600
            );

            await voting.connect(voter1).vote(1, 0);
            await voting.connect(voter2).vote(1, 1);

            expect(await voting.getTotalVotes(1)).to.equal(2);
        });

        it("Should reject total votes for a non-existent poll", async function () {
            await expect(
                voting.getTotalVotes(99)
            ).to.be.revertedWith("Poll does not exist");
        });

        it("Should return poll IDs created by a wallet", async function () {
            await voting.createPoll(
                "Poll 1?",
                ["Yes", "No"],
                3600
            );

            await voting.createPoll(
                "Poll 2?",
                ["A", "B"],
                3600
            );

            expect(await voting.getCreatorPolls(owner.address))
                .to.deep.equal([1n, 2n]);
        });

        it("Should keep different creators' poll IDs separate", async function () {
            await voting.createPoll(
                "Owner poll?",
                ["Yes", "No"],
                3600
            );

            await voting.connect(voter1).createPoll(
                "Voter poll?",
                ["A", "B"],
                3600
            );

            expect(await voting.getCreatorPolls(owner.address))
                .to.deep.equal([1n]);

            expect(await voting.getCreatorPolls(voter1.address))
                .to.deep.equal([2n]);
        });

    });

});
