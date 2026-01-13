// import { normalizeAdb } from "../core/actions/adb.adapter.js";
// import { ADBService } from "../infra/adb/adb.service.js";
// import { retry, makeStepRunner, wrapError } from "../core/actions/_helper.js";

// // const ctx = normalizeAdb(new ADBService())
// // console.log(ctx)
// async function runTests() {
//     try {
//         const result = await retry(async (i) => {
//             console.log("atemp", i)

//             if(i < 2) throw new Error('ADB ERROR')

//             return 'DONE'
//         }, {
//             times: 3,
//             delayMs: 1000,
//             shouldRetry : (e) => String(e?.message).includes("ADB")
//         })

//         console.log("=> Result:: ", result)
//     } catch (e) {
//         console.log(console.error("=> Test 1 Failed", e))
//     }
// }

// async function runTest2() {
//     const step = makeStepRunner({
//         deviceId: 'emulator-5556'
//     })

//     await step("Dang nhap fb lite", async () => {
//         return await retry( async (i) => {
//             console.log(`      [Retry Log] Thử lần ${i}`);
//             if(i  < 5 ) {
//                 throw wrapError('Mạng yếu, không tải được trang', 'FB_LITE_STEP');
//             }
//         }, {
//             times: 5,
//             delayMs: 1000,
//             shouldRetry: (e) => String(e?.message).includes('Mạng yếu')
//         })
//     })
// }

// await runTest2()

