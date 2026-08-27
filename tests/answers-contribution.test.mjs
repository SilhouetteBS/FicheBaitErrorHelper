import test from "node:test";
import assert from "node:assert/strict";
import {
  answersContributionTargets,
  buildAnswersReply,
  isAnswersUrl,
} from "../src/answersContribution.js";

const entry = {
  code: "9011",
  message: "Account locked",
  product: "Laserfiche Server/Repository Server",
};

const source = {
  title: "Access Rights Effective Rights Showing Account locked 9011",
  url: "https://answers.laserfiche.com/questions/231672/example#236898",
};

test("Answers contribution actions accept only the exact Answers host", () => {
  assert.equal(isAnswersUrl(source.url), true);
  assert.equal(isAnswersUrl("http://answers.laserfiche.com/questions/1"), false);
  assert.equal(isAnswersUrl("https://answers.laserfiche.com.example.com/questions/1"), false);
  assert.equal(isAnswersUrl("https://support.laserfiche.com/kb/1"), false);
  assert.equal(isAnswersUrl("not a url"), false);
});

test("Answers replies preserve product, version, scenario, outcome, and context", () => {
  const reply = buildAnswersReply({
    entry,
    source,
    scenario: { title: "Directory account lockout" },
    outcome: "partially-helped",
    versionBuild: "Version 12 build 1202",
    context: "The account unlocked after the directory synchronization completed.",
  });

  assert.match(reply, /Product: Laserfiche Server\/Repository Server/);
  assert.match(reply, /Version\/build: Version 12 build 1202/);
  assert.match(reply, /Error: 9011 - Account locked/);
  assert.match(reply, /Scenario or source reviewed: Directory account lockout/);
  assert.match(reply, /Outcome: Partially helped/);
  assert.match(reply, /Additional relevant details: The account unlocked/);
});

test("Answers contribution targets retain scenario context and omit duplicate generic targets", () => {
  const targets = answersContributionTargets({
    ...entry,
    sources: [
      source,
      { title: "Second Answers discussion", url: "https://answers.laserfiche.com/questions/2/second" },
      { title: "Official documentation", url: "https://doc.laserfiche.com/example" },
    ],
    scenarios: [
      { title: "Directory account lockout", sourceUrls: [source.url] },
    ],
  });

  assert.equal(targets.length, 2);
  assert.equal(targets[0].scenario.title, "Directory account lockout");
  assert.equal(targets[0].source.url, source.url);
  assert.equal(targets[1].scenario, null);
});
