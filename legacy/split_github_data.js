const fs = require("fs");
const path = require("path");
const readline = require("readline");

const inputFile = path.resolve(__dirname, "//mnt/c/temp/input.txt");
const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s/;

const rl = readline.createInterface({
  input: fs.createReadStream(inputFile),
  crlfDelay: Infinity,
});

const lines = [];
let lineNumber = 0;
let foundStart = false;

rl.on("line", (line) => {
  lineNumber++;
  const cleaned = line.replace(timestampRegex, "");
  if (!foundStart) {
    if (cleaned.trim().startsWith("{")) foundStart = true;
    else return;
  }
  lines.push(cleaned);
  console.log(`📄 Line ${lineNumber}: ${cleaned}`);
});

rl.on("close", () => {
  let fullText = lines.join("\n");
  if (fullText.charCodeAt(0) === 0xfeff) fullText = fullText.slice(1);

  try {
    const parsed = JSON.parse(fullText);
    console.log("✅ JSON parsed successfully");

    Object.entries(parsed).forEach(([key, value]) => {
      const outputPath = path.resolve(__dirname, `${key}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(value, null, 2), "utf-8");
      console.log(`📝 Created ${key}.json`);
    });
  } catch (err) {
    console.error("❌ JSON parsing failed");
    console.error(err.message);
    console.error("\n🔍 First 10 cleaned lines:");
    lines.slice(0, 10).forEach((l, idx) => {
      console.error(`Line ${idx + 1}: ${l}`);
    });
    process.exit(1);
  }
});
