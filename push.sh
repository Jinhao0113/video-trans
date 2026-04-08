#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# push.sh — MediaForge 代码提交 & 发布脚本
# 用法: bash push.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── 颜色定义 ─────────────────────────────────────────────────────────────────
BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
GRAY="\033[0;90m"
RESET="\033[0m"

# ── 工具函数 ─────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}  ℹ  $*${RESET}"; }
success() { echo -e "${GREEN}  ✔  $*${RESET}"; }
warn()    { echo -e "${YELLOW}  ⚠  $*${RESET}"; }
error()   { echo -e "${RED}  ✘  $*${RESET}"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }
divider() { echo -e "${GRAY}────────────────────────────────────────────${RESET}"; }

# ── 检查是否在 git 仓库内 ────────────────────────────────────────────────────
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  error "当前目录不是 Git 仓库，请在项目根目录运行此脚本。"
fi

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

echo ""
echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════╗"
echo -e "║       MediaForge 代码提交 & 发布助手          ║"
echo -e "╚═══════════════════════════════════════════════╝${RESET}"

# ── 读取当前版本 ─────────────────────────────────────────────────────────────
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
info "当前版本: ${BOLD}v${CURRENT_VERSION}${RESET}"

# ── 显示 Git 状态 ─────────────────────────────────────────────────────────────
step "Git 状态"
git status -s
divider

# ── 检查是否有变更 ────────────────────────────────────────────────────────────
STAGED=$(git diff --cached --name-only)
UNSTAGED=$(git diff --name-only)
UNTRACKED=$(git ls-files --others --exclude-standard)

HAS_CHANGES=false
if [ -n "$STAGED" ] || [ -n "$UNSTAGED" ] || [ -n "$UNTRACKED" ]; then
  HAS_CHANGES=true
fi

# ── 询问提交信息 ──────────────────────────────────────────────────────────────
if $HAS_CHANGES; then
  step "提交信息"
  echo -e "${GRAY}（留空则跳过提交，直接发布已有的 HEAD）${RESET}"
  read -rp "  📝 Commit message: " COMMIT_MSG

  if [ -n "$COMMIT_MSG" ]; then
    git add -A
    git commit -m "$COMMIT_MSG"
    success "已提交: ${COMMIT_MSG}"
  else
    warn "跳过提交，使用当前 HEAD。"
  fi
else
  info "工作区干净，无需提交。"
fi

# ── 推送到 GitHub main ────────────────────────────────────────────────────────
step "推送到 GitHub"
git push origin main
success "代码已推送到 GitHub main 分支。"

# ── 是否发布 Release ──────────────────────────────────────────────────────────
step "发布 Release"
echo -e "${GRAY}发布 Release 将创建版本 tag 并触发 GitHub Actions 自动构建。${RESET}"
read -rp "  🚀 是否发布新 Release？[y/N] " DO_RELEASE

if [[ ! "$DO_RELEASE" =~ ^[Yy]$ ]]; then
  success "已完成代码推送，未发布 Release。"
  echo ""
  exit 0
fi

# ── 选择版本号 ────────────────────────────────────────────────────────────────
echo ""
echo -e "  当前版本: ${BOLD}v${CURRENT_VERSION}${RESET}"

# 自动计算三种递增版本
IFS='.' read -r VER_MAJOR VER_MINOR VER_PATCH <<< "${CURRENT_VERSION%-*}"
NEXT_PATCH="v${VER_MAJOR}.${VER_MINOR}.$((VER_PATCH + 1))"
NEXT_MINOR="v${VER_MAJOR}.$((VER_MINOR + 1)).0"
NEXT_MAJOR="v$((VER_MAJOR + 1)).0.0"

echo -e "  请选择版本号:"
echo -e "    ${BOLD}1${RESET}) Patch  → ${CYAN}${NEXT_PATCH}${RESET}  （bug 修复）"
echo -e "    ${BOLD}2${RESET}) Minor  → ${CYAN}${NEXT_MINOR}${RESET}  （新功能，向后兼容）"
echo -e "    ${BOLD}3${RESET}) Major  → ${CYAN}${NEXT_MAJOR}${RESET}  （重大变更）"
echo -e "    ${BOLD}4${RESET}) 自定义版本号"

read -rp "  选择 [1-4]: " VERSION_CHOICE

case "$VERSION_CHOICE" in
  1) NEW_TAG="$NEXT_PATCH" ;;
  2) NEW_TAG="$NEXT_MINOR" ;;
  3) NEW_TAG="$NEXT_MAJOR" ;;
  4)
    read -rp "  输入版本号（如 v1.2.0）: " CUSTOM_TAG
    # 确保带 v 前缀
    [[ "$CUSTOM_TAG" == v* ]] && NEW_TAG="$CUSTOM_TAG" || NEW_TAG="v${CUSTOM_TAG}"
    ;;
  *)
    error "无效选择。"
    ;;
esac

NEW_VERSION="${NEW_TAG#v}"  # 去掉 v 前缀，用于 package.json

# ── 确认 ─────────────────────────────────────────────────────────────────────
divider
echo -e "  即将发布: ${BOLD}${GREEN}${NEW_TAG}${RESET}"
read -rp "  确认发布？[y/N] " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  warn "已取消发布。"
  echo ""
  exit 0
fi

# ── 更新 package.json 版本 ────────────────────────────────────────────────────
step "更新 package.json"
# 使用 node 就地更新版本，避免 jq 依赖
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '${NEW_VERSION}';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('  版本已更新: ' + pkg.version);
"
success "package.json 已更新为 ${NEW_VERSION}"

# ── 提交版本变更 ──────────────────────────────────────────────────────────────
git add package.json
git commit -m "chore: bump version to ${NEW_TAG}"
success "已提交版本变更。"

# ── 创建并推送 tag ────────────────────────────────────────────────────────────
step "创建并推送 Tag"

# 如果 tag 已存在则先删除（本地）
if git tag -l "$NEW_TAG" | grep -q "$NEW_TAG"; then
  warn "本地 tag ${NEW_TAG} 已存在，将覆盖..."
  git tag -d "$NEW_TAG"
fi

git tag "$NEW_TAG"
git push origin main
git push origin "$NEW_TAG"

echo ""
divider
success "🎉 发布完成！"
info "Tag ${BOLD}${NEW_TAG}${RESET} 已推送，GitHub Actions 正在构建中..."
info "查看构建进度: https://github.com/Jinhao0113/video-trans/actions"
divider
echo ""
