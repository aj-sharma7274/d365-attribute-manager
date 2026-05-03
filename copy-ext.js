import { cpSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = resolve(__dirname, 'dist')

// manifest.json → dist/
cpSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'))

// background/ → dist/background/
mkdirSync(resolve(dist, 'background'), { recursive: true })
cpSync(resolve(__dirname, 'src/background'), resolve(dist, 'background'), { recursive: true })

// content/ → dist/content/
mkdirSync(resolve(dist, 'content'), { recursive: true })
cpSync(resolve(__dirname, 'src/content'), resolve(dist, 'content'), { recursive: true })

// icons/ → dist/icons/
mkdirSync(resolve(dist, 'icons'), { recursive: true })
if (existsSync(resolve(__dirname, 'public/icons'))) {
  cpSync(resolve(__dirname, 'public/icons'), resolve(dist, 'icons'), { recursive: true })
}

// Create placeholder icons if none exist
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABMSURBVDiNY/z//z8DJYCJgUIw8A0YNWDUAFwGMDIyMjAMtAEsLS0MFy5cGDUAXQMYGBgYGBsbGxn+//8/SBIwMDAwMDg4OFBiAADxbRQPQ7bKGgAAAABJRU5ErkJggg==',
  'base64'
)
;['icon16', 'icon48', 'icon128'].forEach(name => {
  const iconPath = resolve(dist, 'icons', `${name}.png`)
  if (!existsSync(iconPath)) writeFileSync(iconPath, png)
})

// Fix popup path — move dist/src/popup → dist/popup
if (existsSync(resolve(dist, 'src/popup'))) {
  mkdirSync(resolve(dist, 'popup'), { recursive: true })
  cpSync(resolve(dist, 'src/popup'), resolve(dist, 'popup'), { recursive: true })
}

// Fix app path — move dist/src/app → dist/app
if (existsSync(resolve(dist, 'src/app'))) {
  mkdirSync(resolve(dist, 'app'), { recursive: true })
  cpSync(resolve(dist, 'src/app'), resolve(dist, 'app'), { recursive: true })
}

console.log('✅ Extension files copied to dist/')