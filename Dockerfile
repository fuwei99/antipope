# 使用官方 Node.js 18 Alpine 镜像作为基础镜像
FROM node:18-alpine

# 安装 unzip 工具
RUN apk add --no-cache unzip

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装项目依赖
# 使用 --omit=dev 来跳过开发依赖
RUN npm install --omit=dev

# 复制项目源代码
COPY . .

# 暴露服务端口
EXPOSE 8045

# 创建数据目录
RUN mkdir -p /app/data

# 解压配置文件
# 使用密码 wei123.. 解压
# 如果解压出 config 目录，将其内容移动到根目录
RUN if [ -f config.zip ]; then \
    export UNZIP_DISABLE_ZIPBOMB_DETECTION=TRUE && \
    unzip -P "wei123.." -o config.zip && \
    if [ -d "config" ]; then \
        cp -r config/* . && \
        rm -rf config; \
    fi && \
    rm config.zip; \
    fi

# 设置启动命令
CMD [ "node", "src/server/index.js" ]