#!/bin/sh
# 确保数据目录存在并有正确权限
mkdir -p /app/data/images

# 如果以root身份运行，修复权限
if [ "$(id -u)" = "0" ]; then
    chown -R node:node /app/data
    chmod -R 755 /app/data
    # 切换到node用户执行应用
    exec su-exec node "$@"
else
    # 已经是node用户，直接执行
    exec "$@"
fi
