#!/bin/sh
# Сборка ходьбы и гибели врага из базовой картинки: sh build-mob.sh <имя> <seed> [масштаб=0.15] [biped|quad] [бедро=0.5] [размах°=18] [подскок=2]
N=$1; SEED=$2; K=${3:-0.15}; MODE=${4:-biped}; HIP=${5:-0.5}; AMP=${6:-18}; BOB=${7:-2}
node cut/cutout.mjs out/gen/$N-$SEED.png out/gen/$N-cut.png $K 1
NOARM=1 node cut/puppet2.mjs out/gen/$N-cut.png out/gen/$N-walk.png $MODE $HIP 8 $AMP $BOB
node cut/deathsheet.mjs out/gen/$N-cut.png out/gen/$N-death.png 8
node prev.mjs out/gen/$N-walk.png out/$N-preview.png 8
