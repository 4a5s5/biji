#!/bin/bash

# Docker Hub 镜像更新脚本
# 使用方法: ./update-docker.sh [版本号]

set -e

# 配置
DOCKER_USERNAME="4a5s5"
IMAGE_NAME="smart-note-collector"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

# 获取版本号参数，默认为当前时间戳
VERSION=${1:-$(date +%Y%m%d-%H%M%S)}

echo "🚀 开始更新 Docker 镜像..."
echo "📦 镜像名称: ${FULL_IMAGE_NAME}"
echo "🏷️  版本标签: ${VERSION}"

# 1. 构建镜像
echo "🔨 构建镜像..."
docker build -t ${FULL_IMAGE_NAME}:latest .
docker build -t ${FULL_IMAGE_NAME}:${VERSION} .

# 2. 检查镜像是否构建成功
echo "✅ 验证镜像构建..."
docker images ${FULL_IMAGE_NAME}

# 3. 推送到 Docker Hub
echo "📤 推送镜像到 Docker Hub..."
docker push ${FULL_IMAGE_NAME}:latest
docker push ${FULL_IMAGE_NAME}:${VERSION}

echo "🎉 Docker 镜像更新完成！"
echo "📋 可用标签:"
echo "   - ${FULL_IMAGE_NAME}:latest"
echo "   - ${FULL_IMAGE_NAME}:${VERSION}"
echo ""
echo "🔧 在 Claw Cloud 中使用:"
echo "   docker pull ${FULL_IMAGE_NAME}:latest"
echo "   docker run -d -p 3000:3000 ${FULL_IMAGE_NAME}:latest"
