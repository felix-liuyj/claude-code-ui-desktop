const fs = require('fs');
const path = require('path');

/**
 * Claude Code UI 图标生成器
 * 生成不同尺寸的SVG应用图标
 * 设计风格：MessageSquare（聊天气泡）与侧边栏一致
 */

// 需要生成的图标尺寸
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// 颜色配置
const colors = {
    background: 'hsl(262.1 83.3% 57.8%)', // Claude品牌紫色
    icon: 'white',                        // 图标颜色
    // 替代颜色方案（可选）
    // background: '#8B5CF6',             // 紫色
    // background: '#6366F1',             // 靛蓝
    // background: '#3B82F6',             // 蓝色
};

/**
 * 创建SVG图标内容
 * @param {number} size - 图标尺寸（像素）
 * @returns {string} SVG内容
 */
function createIconSVG(size) {
    // 计算自适应参数
    const cornerRadius = Math.round(size * 0.25);        // 25% 圆角半径
    const strokeWidth = Math.max(2, Math.round(size * 0.06)); // 自适应描边宽度

    // MessageSquare 聊天气泡路径参数
    const padding = Math.round(size * 0.25);             // 内边距
    const iconSize = size - (padding * 2);               // 图标实际大小
    const startX = padding;
    const startY = Math.round(padding * 0.7);
    const endX = startX + iconSize;
    const endY = startY + Math.round(iconSize * 0.6);
    const tailX = startX;
    const tailY = endY + Math.round(iconSize * 0.3);

    // 优化的聊天气泡路径
    const bubbleCornerRadius = Math.max(8, Math.round(size * 0.04));
    const bubbleWidth = iconSize;
    const bubbleHeight = Math.round(iconSize * 0.6);

    return `<svg width="${ size }" height="${ size }" viewBox="0 0 ${ size } ${ size }" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 应用图标背景 -->
  <rect width="${ size }" height="${ size }" rx="${ cornerRadius }" fill="${ colors.background }"/>
  
  <!-- MessageSquare 聊天气泡图标 -->
  <g>
    <!-- 聊天气泡主体 -->
    <rect x="${ startX }" 
          y="${ startY }" 
          width="${ bubbleWidth }" 
          height="${ bubbleHeight }" 
          rx="${ bubbleCornerRadius }" 
          stroke="${ colors.icon }" 
          stroke-width="${ strokeWidth }" 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          fill="none"/>
    
    <!-- 聊天气泡尾巴 -->
    <path d="M${ startX + Math.round(bubbleWidth * 0.15) } ${ startY + bubbleHeight }L${ tailX } ${ tailY }L${ startX + Math.round(bubbleWidth * 0.35) } ${ startY + bubbleHeight }Z" 
          stroke="${ colors.icon }" 
          stroke-width="${ strokeWidth }" 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          fill="none"/>
  </g>
  
  <!-- 品质标记（可选，用于调试） -->
  <!-- <circle cx="${ size - 10 }" cy="10" r="3" fill="${ colors.icon }" opacity="0.5"/> -->
</svg>`;
}

/**
 * 确保icons目录存在
 */
function ensureIconsDirectory() {
    const iconsDir = path.join(__dirname, 'icons');
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
        console.log('📁 创建icons目录');
    }
}

/**
 * 生成所有尺寸的SVG图标
 */
function generateIcons() {
    console.log('🚀 开始生成Claude Code UI图标...\n');

    ensureIconsDirectory();

    let successCount = 0;

    sizes.forEach(size => {
        try {
            const svgContent = createIconSVG(size);
            const filename = `icon-${ size }x${ size }.svg`;
            const filepath = path.join(__dirname, 'icons', filename);

            fs.writeFileSync(filepath, svgContent, 'utf8');
            console.log(`✅ 已生成: ${ filename } (${ size }x${ size }px)`);
            successCount++;
        } catch (error) {
            console.error(`❌ 生成失败: icon-${ size }x${ size }.svg - ${ error.message }`);
        }
    });

    console.log(`\n🎉 图标生成完成! 成功生成 ${ successCount }/${ sizes.length } 个图标`);

    // 提供后续转换建议
    console.log('\n📋 后续步骤 - 转换为PNG格式:');
    console.log('1. 在线转换器: https://cloudconvert.com/svg-to-png');
    console.log('2. ImageMagick: magick icon-XXXxXXX.svg icon-XXXxXXX.png');
    console.log('3. Inkscape: inkscape --export-type=png --export-filename="icon.png" icon.svg');
    console.log('4. 批量转换: 参考 convert-icons.md 文档');

    console.log('\n🔧 Electron应用额外步骤:');
    console.log('- 为build目录生成 .icns (macOS) 和 .ico (Windows) 格式');
    console.log('- 使用 imagemagick: magick icon-512x512.png build/icon.icns');
}

/**
 * 主函数
 */
function main() {
    try {
        generateIcons();
    } catch (error) {
        console.error('💥 程序执行失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

// 导出函数供其他脚本使用
module.exports = {
    createIconSVG,
    generateIcons,
    sizes,
    colors
};