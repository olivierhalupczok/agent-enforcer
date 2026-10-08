// Compiles the stylesheet design-sync ships (apps/web/dist/ds.css, cfg.cssEntry).
// The app's own vite build only emits the Tailwind utilities its source uses, so a design built
// from the synced kit would write classes that resolve to nothing. This compiles the app's real
// src/index.css (same @theme tokens, same base layer) with the app sources, the authored previews
// and a safelist of the utility families the conventions header documents.
// Run from the repo root: node .design-sync/build-css.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const web = resolve(root, 'apps/web')
const require = createRequire(resolve(web, 'package.json'))
const pnpmReq = createRequire(require.resolve('@tailwindcss/vite'))
const { compile } = await import(pnpmReq.resolve('@tailwindcss/node'))
const { Scanner } = await import(pnpmReq.resolve('@tailwindcss/oxide'))

const FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'

const COLORS =
  'ink,sidebar,sidebar-active,sidebar-muted,sidebar-subtle,sidebar-track,canvas,surface,line,line-strong,muted,teal,teal-dark,teal-soft,teal-bright,amber,warn-bg,warn-fg,danger,white,black,transparent,current'
const SPACE = '0,px,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32'
const SIZES = `${SPACE},36,40,48,56,64,72,80,96,auto,full,screen,fit,min,max,1/2,1/3,2/3,1/4,3/4`
const SAFELIST = [
  `{,hover:,focus:}{bg,text,border,ring,outline,fill,stroke,divide,decoration}-{${COLORS}}`,
  `{,sm:,md:,lg:}{p,px,py,pt,pb,pl,pr,m,mx,my,mt,mb,ml,mr,gap,gap-x,gap-y,space-y,space-x}-{${SPACE}}`,
  `{,sm:,md:,lg:}{w,h,min-w,min-h,max-h,size}-{${SIZES}}`,
  '{,sm:,md:,lg:}max-w-{xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,full,none,prose}',
  '{,sm:,md:,lg:}{flex,inline-flex,grid,inline-grid,block,inline-block,inline,hidden,contents}',
  '{,sm:,md:,lg:}{flex-row,flex-col,flex-wrap,flex-nowrap,flex-1,flex-auto,flex-none,grow,shrink-0}',
  '{,sm:,md:,lg:}grid-cols-{1,2,3,4,5,6,8,12}',
  '{,sm:,md:,lg:}col-span-{1,2,3,4,5,6,8,12,full}',
  '{,sm:,md:,lg:}{items,self}-{start,center,end,stretch,baseline}',
  '{,sm:,md:,lg:}justify-{start,center,end,between,around,evenly}',
  '{,sm:,md:}text-{xs,sm,base,lg,xl,2xl,3xl,4xl,left,center,right}',
  'font-{normal,medium,semibold,bold,sans,mono}',
  'leading-{none,tight,snug,normal,relaxed,4,5,6,7}',
  'tracking-{tighter,tight,normal,wide,wider,widest}',
  '{uppercase,lowercase,capitalize,truncate,italic,underline,no-underline,whitespace-nowrap,break-words,break-all,tabular-nums}',
  'rounded{,-none,-sm,-md,-lg,-xl,-2xl,-full}',
  'border{,-0,-2,-t,-b,-l,-r,-x,-y,-dashed,-solid}',
  'divide-{x,y}',
  'ring{,-0,-1,-2}',
  'shadow{,-none,-sm,-md,-lg,-xl}',
  'opacity-{0,25,50,60,75,100}',
  '{relative,absolute,fixed,sticky,static,inset-0,top-0,right-0,bottom-0,left-0,z-10,z-20,z-30,z-40,z-50}',
  'overflow{,-x,-y}-{auto,hidden,visible,scroll}',
  '{cursor-pointer,cursor-not-allowed,select-none,sr-only,list-none,transition,transition-colors}',
  '{min-w-0,shrink,aspect-square,aspect-video,object-cover,object-contain}',
]

const indexCss = readFileSync(resolve(web, 'src/index.css'), 'utf8')
const input = [
  indexCss,
  `@source "${resolve(root, '.design-sync/previews')}";`,
  ...SAFELIST.map((s) => `@source inline("${s}");`),
].join('\n')

const compiler = await compile(input, { base: resolve(web, 'src'), onDependency: () => {} })
const scanner = new Scanner({ sources: [{ base: resolve(web, 'src'), pattern: '**/*', negated: false }, ...compiler.sources] })
const css = compiler.build(scanner.scan())

const out = resolve(web, 'dist/ds.css')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `@import url("${FONTS}");\n${css}`)
console.log(`wrote ${out} (${Math.round(css.length / 1024)} KB)`)
