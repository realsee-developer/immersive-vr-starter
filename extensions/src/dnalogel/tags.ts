import type { PanoTagPlugin, Tag } from '@realsee/dnalogel'

type TagsController = ReturnType<typeof PanoTagPlugin>

export async function addTextHotspot(tags: TagsController, position: [number, number, number]) {
  const tag: Tag<'Text', '2DPoint'> = {
    id: 'welcome', contentType: 'Text', stickType: '2DPoint', position,
    data: { title: 'Welcome', description: 'Explore this captured space.' }
  }
  await tags.load({ tagList: [tag] })
  tags.enable()
  await tags.show()
  const stop = tags.hooks.on('click', ({ tag: clicked }) => {
    if (clicked.id === 'welcome') tags.changeUnfoldedById('welcome', true)
  })
  return () => { stop(); tags.destroyTagById('welcome') }
}
