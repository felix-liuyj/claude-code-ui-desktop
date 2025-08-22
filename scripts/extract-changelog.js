#!/usr/bin/env node

/**
 * 从 CHANGELOG.md 中提取当前版本的变更日志
 * 用于 GitHub Release 创建
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取 package.json 获取当前版本
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const currentVersion = packageJson.version;

// 读取 CHANGELOG.md
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const changelogContent = fs.readFileSync(changelogPath, 'utf8');

// 提取当前版本的变更内容（优先选择中文版本）
function extractVersionChangelog(content, version) {
  const lines = content.split('\n');
  const versionPattern = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`);
  
  let chineseStartIndex = -1;
  let englishStartIndex = -1;
  
  // 查找所有匹配的版本标题
  for (let i = 0; i < lines.length; i++) {
    if (versionPattern.test(lines[i])) {
      if (englishStartIndex === -1) {
        englishStartIndex = i;
      } else if (chineseStartIndex === -1) {
        // 第二个匹配的通常是中文版本（更详细）
        chineseStartIndex = i;
        break;
      }
    }
  }
  
  // 优先使用中文版本，否则使用英文版本
  const startIndex = chineseStartIndex !== -1 ? chineseStartIndex : englishStartIndex;
  
  if (startIndex === -1) {
    console.error(`未找到版本 ${version} 的变更日志`);
    process.exit(1);
  }
  
  // 查找下一个版本标题或分隔线作为结束位置
  let endIndex = -1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## [') || line === '---') {
      endIndex = i;
      break;
    }
  }
  
  // 如果没有找到结束位置，使用文件末尾
  if (endIndex === -1) {
    endIndex = lines.length;
  }
  
  // 提取版本内容，去除版本标题行
  const versionLines = lines.slice(startIndex + 1, endIndex);
  
  // 移除开头和结尾的空行
  while (versionLines.length > 0 && versionLines[0].trim() === '') {
    versionLines.shift();
  }
  while (versionLines.length > 0 && versionLines[versionLines.length - 1].trim() === '') {
    versionLines.pop();
  }
  
  return versionLines.join('\n');
}

try {
  const versionChangelog = extractVersionChangelog(changelogContent, currentVersion);
  
  if (versionChangelog.trim()) {
    console.log(versionChangelog);
  } else {
    console.error(`版本 ${currentVersion} 的变更日志为空`);
    process.exit(1);
  }
} catch (error) {
  console.error('提取变更日志失败:', error.message);
  process.exit(1);
}