#!/usr/bin/env node

// 测试数据库创建的脚本
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 模拟Electron环境
process.env.ELECTRON_APP = 'true';
process.env.ELECTRON_USER_DATA = join(process.cwd(), 'test-userdata');

console.log('测试数据库初始化...');
console.log('用户数据路径:', process.env.ELECTRON_USER_DATA);

try {
  // 确保测试目录存在
  if (!fs.existsSync(process.env.ELECTRON_USER_DATA)) {
    fs.mkdirSync(process.env.ELECTRON_USER_DATA, { recursive: true });
  }

  // 导入数据库模块
  const { initializeDatabase } = await import('../server/database/db.js');
  
  // 初始化数据库
  await initializeDatabase();
  
  console.log('✅ 数据库测试成功！');
  
  // 清理测试文件
  const dbPath = join(process.env.ELECTRON_USER_DATA, 'auth.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🧹 清理测试数据库文件');
  }
  
  // 清理测试目录
  if (fs.existsSync(process.env.ELECTRON_USER_DATA)) {
    fs.rmSync(process.env.ELECTRON_USER_DATA, { recursive: true, force: true });
    console.log('🧹 清理测试目录');
  }
  
} catch (error) {
  console.error('❌ 数据库测试失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
