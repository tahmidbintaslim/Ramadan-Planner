import { execSync } from "node:child_process";

const MAX_CHANGED_FILES = 40;

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trimEnd();
}

function main() {
  const output = run("git status --porcelain");
  if (!output) {
    console.log("Worktree clean.");
    return;
  }

  const lines = output.split("\n").filter(Boolean);
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  let mixed = 0;

  for (const line of lines) {
    const x = line[0];
    const y = line[1];

    if (x === "?" && y === "?") {
      untracked += 1;
      continue;
    }

    if (x !== " ") staged += 1;
    if (y !== " ") unstaged += 1;
    if (x !== " " && y !== " ") mixed += 1;
  }

  const total = lines.length;
  console.log(`Changed files: ${total}`);
  console.log(`Staged: ${staged}, Unstaged: ${unstaged}, Untracked: ${untracked}, Mixed: ${mixed}`);

  const errors = [];
  if (mixed > 0) {
    errors.push(`Found ${mixed} files with both staged and unstaged edits.`);
  }
  if (total > MAX_CHANGED_FILES) {
    errors.push(`Changed files (${total}) exceed recommended release threshold (${MAX_CHANGED_FILES}).`);
  }

  if (errors.length > 0) {
    console.error("\nWorktree audit failed:");
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    console.error("\nRecommendation: split into smaller commits/PRs and avoid mixed staged+unstaged files.");
    process.exit(1);
  }

  console.log("\nWorktree audit passed.");
}

main();
