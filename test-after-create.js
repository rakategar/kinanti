// test-after-create.js
// Test handler guru_after_create

require("dotenv").config();

const { getState, setState, clearState } = require("./src/services/state");

const prismaMod = require("./src/config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;

async function testAfterCreate() {
  const testPhone = "628123456789"; // Test phone number

  console.log("========== TEST guru_after_create HANDLER ==========\n");

  // 1. Simulate state after task creation
  console.log("1. Setting up state like after task creation...");
  const simulatedState = {
    lastIntent: "guru_after_create",
    slots: {
      createdKode: "TEST-123",
      createdKelas: "XTKJ1",
    },
  };
  await setState(testPhone, simulatedState);

  // 2. Verify state is saved
  const savedState = await getState(testPhone);
  console.log("   Saved state:", JSON.stringify(savedState, null, 2));

  // 3. Test condition check
  console.log("\n2. Testing condition checks...");
  console.log("   savedState?.lastIntent:", savedState?.lastIntent);
  console.log(
    "   Is guru_after_create?:",
    savedState?.lastIntent === "guru_after_create"
  );
  console.log("   savedState.slots:", savedState?.slots);
  console.log("   createdKode:", savedState?.slots?.createdKode);
  console.log("   createdKelas:", savedState?.slots?.createdKelas);

  // 4. Simulate user input "1"
  console.log("\n3. Simulating user input '1'...");
  const raw = "1";
  console.log("   Input:", raw);
  console.log("   /^1$/.test(raw):", /^1$/.test(raw));

  // 5. Test the handler logic
  console.log("\n4. Testing handler logic...");
  if (savedState?.lastIntent === "guru_after_create") {
    console.log("   ✅ Condition matched: lastIntent === 'guru_after_create'");

    const { createdKode, createdKelas } = savedState.slots || {};
    console.log("   createdKode:", createdKode);
    console.log("   createdKelas:", createdKelas);

    if (/^1$/.test(raw)) {
      console.log("   ✅ User chose option 1 (send to class)");

      // Test database lookup
      console.log("\n5. Testing database lookup...");
      try {
        const asg = await prisma.assignment.findUnique({
          where: { kode: createdKode },
          include: { guru: true },
        });

        if (asg) {
          console.log("   ✅ Assignment found:", asg.kode, "-", asg.judul);
        } else {
          console.log("   ❌ Assignment NOT found with kode:", createdKode);
        }

        const siswa = await prisma.user.findMany({
          where: { role: "siswa", kelas: createdKelas },
        });
        console.log("   Students in class", createdKelas + ":", siswa.length);
      } catch (err) {
        console.log("   ❌ Database error:", err.message);
      }
    }
  } else {
    console.log("   ❌ Condition NOT matched");
    console.log("   Expected lastIntent: 'guru_after_create'");
    console.log("   Actual lastIntent:", savedState?.lastIntent);
  }

  // Cleanup
  console.log("\n6. Cleaning up test state...");
  await clearState(testPhone);
  console.log("   ✅ State cleared");

  console.log("\n========== TEST COMPLETE ==========");
  process.exit(0);
}

testAfterCreate().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
