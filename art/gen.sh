#!/bin/zsh
cd ~/Desktop/claudecode/yukigassen/art
G=~/.claude/skills/3d-homepage/scripts/codex_imagegen.py
[ -f raw/front_a.png ] || python3 $G raw/front_a.png prompts/front_a.md --quality high --size 1536x1024 > logs/front_a.log 2>&1 || { echo FAIL a; exit 1; }
for k in back_b front_c back_d trees_e; do
  [ -f raw/$k.png ] || python3 $G raw/$k.png prompts/$k.md raw/front_a.png --quality high --size 1536x1024 > logs/$k.log 2>&1 &
done
wait
for k in props_f; do [ -f raw/$k.png ] || python3 $G raw/$k.png prompts/$k.md raw/front_a.png --quality high --size 1536x1024 > logs/$k.log 2>&1 & done
[ -f raw/bg_g.png ] || python3 $G raw/bg_g.png prompts/bg_g.md raw/front_a.png --quality high --size 1536x1024 > logs/bg_g.log 2>&1 &
wait
ls -la raw/
