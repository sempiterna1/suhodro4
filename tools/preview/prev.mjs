import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
const [,, src, dst, n] = process.argv
const im=await loadImage(src);const S=3, N=Number(n)
const c=createCanvas(im.width*S/ (N>6?2:1) ,im.height*S*(N>6?2:1));const g=c.getContext('2d');g.fillStyle='#a9b8cf';g.fillRect(0,0,c.width,c.height);g.imageSmoothingEnabled=false
const fw=im.width/N, cols=N>6?4:N
for(let i=0;i<N;i++)g.drawImage(im,i*fw,0,fw,im.height,(i%cols)*fw*S,Math.floor(i/cols)*im.height*S,fw*S,im.height*S)
writeFileSync(dst,c.toBuffer('image/png'))
