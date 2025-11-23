import fs from 'fs';
import path from 'path';
import { generateRequestBody } from '../src/utils/utils.js';

// 配置
const API_URL = 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse';
const HOST = 'daily-cloudcode-pa.sandbox.googleapis.com';
const USER_AGENT = 'antigravity/1.11.3 windows/amd64';
const MODEL_NAME = 'gemini-2.5-flash-image';

async function getToken() {
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

async function testImageGeneration() {
    const token = await getToken();
    console.log(`使用 Token: ${token.substring(0, 10)}...`);

    const messages = [
        { role: 'user', content: '画一只可爱的小狗' }
    ];

    // 使用 utils 生成标准请求体
    const requestBody = generateRequestBody(messages, MODEL_NAME, {}, []);

    // 手动调整 generationConfig
    if (!requestBody.request.generationConfig) {
        requestBody.request.generationConfig = {};
    }

    // 必须显式启用 IMAGE 模态
    requestBody.request.generationConfig.responseModalities = ["TEXT", "IMAGE"];

    // 注意：gemini-2.5-flash-image 不支持 imageConfig (imageSize)，所以这里不添加

    // 打印请求体以便调试
    console.log('请求体:', JSON.stringify(requestBody, null, 2));

    // 清空或创建 image.txt
    const responseFile = path.join(process.cwd(), 'image.txt');
    fs.writeFileSync(responseFile, '');
    console.log(`响应将保存到: ${responseFile}`);

    console.log('正在发送请求...');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Host': HOST,
                'User-Agent': USER_AGENT,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept-Encoding': 'gzip'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        console.log('正在接收流式响应...');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);

            // 追加写入文件
            fs.appendFileSync(responseFile, chunk);

            // 简单的进度指示
            process.stdout.write('.');
        }
        console.log('\n\n响应结束，完整内容已保存到 image.txt');

    } catch (error) {
        console.error('测试失败:', error);
    }
}

testImageGeneration();