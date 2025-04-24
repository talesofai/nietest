#!/usr/bin/env node

/**
 * 代码质量报告生成工具
 *
 * 这个脚本用于生成代码质量报告，包括：
 * - ESLint 报告
 * - 代码复杂度报告
 * - 依赖分析报告
 *
 * 使用方法:
 * - 生成所有报告: node scripts/generate-report.js
 * - 生成特定报告: node scripts/generate-report.js --type=eslint,complexity
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);
const params = {};
args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    params[key] = value || true;
  }
});

// 默认生成所有报告
const reportTypes = params.type ? params.type.split(',') : ['eslint', 'complexity', 'deps'];

// 创建报告目录
const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 打印带颜色的消息
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 运行命令并处理错误
function runCommand(command, errorMessage) {
  try {
    log(`运行: ${command}`, 'cyan');
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    log(`${errorMessage}: ${error.message}`, 'red');
    return null;
  }
}

// 生成 ESLint 报告
if (reportTypes.includes('eslint')) {
  log('\n📊 生成 ESLint 报告...', 'blue');

  try {
    const eslintReport = runCommand(
      'npx eslint . --ext .ts,.tsx,.js,.jsx -c .eslintrc.json -f json --ignore-pattern "example/**" --ignore-pattern "example"',
      'ESLint 报告生成失败'
    );

    if (eslintReport) {
      const reportPath = path.join(reportsDir, 'eslint-report.json');
      fs.writeFileSync(reportPath, eslintReport);

      // 生成 HTML 报告
      const htmlReportPath = path.join(reportsDir, 'eslint-report.html');
      const htmlReport = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ESLint 报告</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            h1 { color: #333; }
            .summary { margin-bottom: 20px; }
            .file { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
            .file-header { background: #f5f5f5; padding: 10px; font-weight: bold; }
            .file-path { color: #666; }
            .messages { padding: 0; }
            .message { padding: 10px; border-top: 1px solid #ddd; display: flex; }
            .message:nth-child(odd) { background: #f9f9f9; }
            .severity { width: 80px; }
            .error { color: #d73a49; }
            .warning { color: #e36209; }
            .message-content { flex: 1; }
            .rule { color: #6f42c1; font-family: monospace; }
            .location { color: #666; font-size: 0.9em; margin-top: 5px; }
          </style>
        </head>
        <body>
          <h1>ESLint 报告</h1>
          <div class="summary">
            <p>生成时间: ${new Date().toLocaleString()}</p>
            <p>报告路径: ${reportPath}</p>
          </div>
          <div id="report"></div>

          <script>
            const report = ${eslintReport};
            const reportElement = document.getElementById('report');

            // 统计错误和警告数量
            let errorCount = 0;
            let warningCount = 0;

            report.forEach(file => {
              errorCount += file.errorCount;
              warningCount += file.warningCount;

              if (file.messages.length === 0) return;

              const fileElement = document.createElement('div');
              fileElement.className = 'file';

              const fileHeader = document.createElement('div');
              fileHeader.className = 'file-header';
              fileHeader.innerHTML = \`
                <div class="file-path">\${file.filePath.replace(/^.*[\\\\\\/]/, '')}</div>
                <div>错误: \${file.errorCount}, 警告: \${file.warningCount}</div>
              \`;

              const messagesElement = document.createElement('div');
              messagesElement.className = 'messages';

              file.messages.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.className = 'message';

                const severityClass = message.severity === 2 ? 'error' : 'warning';
                const severityText = message.severity === 2 ? '错误' : '警告';

                messageElement.innerHTML = \`
                  <div class="severity \${severityClass}">\${severityText}</div>
                  <div class="message-content">
                    <div>\${message.message}</div>
                    <div class="rule">\${message.ruleId || '未知规则'}</div>
                    <div class="location">行 \${message.line}, 列 \${message.column}</div>
                  </div>
                \`;

                messagesElement.appendChild(messageElement);
              });

              fileElement.appendChild(fileHeader);
              fileElement.appendChild(messagesElement);
              reportElement.appendChild(fileElement);
            });

            // 更新摘要
            const summary = document.querySelector('.summary');
            summary.innerHTML += \`<p>总计: \${errorCount} 个错误, \${warningCount} 个警告</p>\`;
          </script>
        </body>
        </html>
      `;

      fs.writeFileSync(htmlReportPath, htmlReport);
      log(`✅ ESLint 报告已生成: ${reportPath}`, 'green');
      log(`✅ ESLint HTML 报告已生成: ${htmlReportPath}`, 'green');
    }
  } catch (error) {
    log(`❌ ESLint 报告生成失败: ${error.message}`, 'red');
  }
}

// 生成代码复杂度报告
if (reportTypes.includes('complexity')) {
  log('\n📊 生成代码复杂度报告...', 'blue');

  try {
    // 安装 complexity-report 如果需要
    try {
      execSync('npx complexity-report --version', { stdio: 'ignore' });
    } catch (e) {
      log('安装 complexity-report...', 'yellow');
      execSync('npm install -g complexity-report', { stdio: 'inherit' });
    }

    const complexityReport = runCommand(
      'npx cr -f json -o reports/complexity-report.json "app/components/*.js" "components/*.js"',
      '代码复杂度报告生成失败'
    );

    if (complexityReport) {
      log(`✅ 代码复杂度报告已生成: reports/complexity-report.json`, 'green');
    }
  } catch (error) {
    log(`❌ 代码复杂度报告生成失败: ${error.message}`, 'red');
    log('提示: 您可能需要全局安装 complexity-report: npm install -g complexity-report', 'yellow');
  }
}

// 生成依赖分析报告
if (reportTypes.includes('deps')) {
  log('\n📊 生成依赖分析报告...', 'blue');

  try {
    const depsReport = runCommand(
      'npx npm-check --json',
      '依赖分析报告生成失败'
    );

    if (depsReport) {
      const reportPath = path.join(reportsDir, 'deps-report.json');
      fs.writeFileSync(reportPath, depsReport);
      log(`✅ 依赖分析报告已生成: ${reportPath}`, 'green');
    }
  } catch (error) {
    log(`❌ 依赖分析报告生成失败: ${error.message}`, 'red');
  }
}

log('\n✅ 报告生成完成！所有报告都保存在 reports/ 目录中。', 'green');
