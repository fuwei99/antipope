import fs from 'fs';
import path from 'path';
import https from 'https';

// 配置
const API_URL = 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse';
const HOST = 'daily-cloudcode-pa.sandbox.googleapis.com';
const USER_AGENT = 'antigravity/1.11.3 windows/amd64';
const MODEL_NAME = 'gemini-3-pro-image';
const IMAGE_URL = 'https://image.maltobitoo.xyz/images/202511/6ee2dd086482f539_1763913544193.jpg';

// 获取 Token
function getToken() {
    try {
        const accountsFile = path.join(process.cwd(), 'data', 'accounts.json');
        const data = fs.readFileSync(accountsFile, 'utf8');
        const accounts = JSON.parse(data);
        const validAccount = accounts.find(acc => acc.enable !== false);
        if (!validAccount) {
            throw new Error('没有可用的 Token');
        }
        return validAccount.access_token;
    } catch (error) {
        console.error('获取 Token 失败:', error.message);
        process.exit(1);
    }
}

// 下载图片并转 Base64
function fetchImageBase64(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                resolve(buffer.toString('base64'));
            });
        }).on('error', (err) => reject(err));
    });
}

// 发送请求
async function sendRequest(contents, token) {
    const requestBody = {
        model: MODEL_NAME,
        request: {
            contents: contents,
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                imageConfig: { imageSize: "2k" }
            }
        },
        userAgent: "antigravity"
    };

    console.log('发送请求...');
    // console.log(JSON.stringify(requestBody, null, 2));

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Host': HOST,
            'User-Agent': USER_AGENT,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error (${response.status}): ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        // 简单解析一下文本，忽略复杂的 SSE 格式
        fullText += chunk;
    }
    return fullText;
}

async function runTest() {
    const token = getToken();
    console.log(`使用 Token: ${token.substring(0, 10)}...`);

    // 1. 准备图片数据
    console.log(`正在下载图片: ${IMAGE_URL}`);
    const imageBase64 = await fetchImageBase64(IMAGE_URL);
    console.log('图片下载完成，Base64 长度:', imageBase64.length);

    // 2. 构造多轮对话历史
    // 模拟场景：
    // User: 画一张图 (实际上我们跳过这一步的真实生成，直接构造历史)
    // Model: (假装生成了图片) 好的。
    // User: 改一下颜色 (附带了刚才那张图)

    const contents = [
        {
            role: "user",
            parts: [{ text: "画一张赛博朋克风格的猫" }]
        },
        {
            role: "model",
            parts: [
                {
                    thought: true,
                    text: "Thinking Process...",
                    thought_signature: "fake_signature_12345"
                },
                { text: "好的，这是一张赛博朋克风格的猫。" }
            ]
        },
        {
            role: "user",
            parts: [
                { text: "把它变成红色的" },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: imageBase64
                    }
                }
            ]
        }
    ];

    try {
        console.log('\n--- 开始测试多轮对话 (带伪造签名) ---');
        const result = await sendRequest(contents, token);
        console.log('请求成功！API 返回内容片段:');
        console.log(result.substring(0, 500) + '...');

        if (result.includes('inlineData')) {
            console.log('\n✅ 成功检测到返回了图片数据！');
        } else {
            console.log('\n⚠️ 未检测到图片数据，可能只返回了文本。');
        }

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
    }
}

runTest();