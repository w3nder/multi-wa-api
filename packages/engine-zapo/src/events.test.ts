import { describe, expect, it } from 'vitest'
import { mapZapoContent } from './events'

describe('mapZapoContent', () => {
  it('maps plain text', () => {
    expect(mapZapoContent({ conversation: 'hi' })).toEqual({ type: 'text', text: 'hi' })
  })

  it('maps document with filename and metadata', () => {
    expect(
      mapZapoContent({
        documentMessage: {
          mimetype: 'application/pdf',
          fileLength: 999,
          fileName: 'nf.pdf',
          pageCount: 3
        }
      })
    ).toEqual({
      type: 'document',
      media: {
        mimetype: 'application/pdf',
        size: 999,
        width: undefined,
        height: undefined,
        seconds: undefined
      },
      fileName: 'nf.pdf',
      caption: undefined,
      pageCount: 3
    })
  })

  it('maps video with gif flag', () => {
    expect(
      mapZapoContent({ videoMessage: { mimetype: 'video/mp4', gifPlayback: true, caption: 'c' } })
    ).toMatchObject({ type: 'video', caption: 'c', gif: true })
  })

  it('maps contact', () => {
    expect(
      mapZapoContent({ contactMessage: { displayName: 'João', vcard: 'BEGIN:VCARD' } })
    ).toEqual({ type: 'contact', displayName: 'João', vcard: 'BEGIN:VCARD' })
  })

  it('maps list response', () => {
    expect(
      mapZapoContent({
        listResponseMessage: { title: 'T', singleSelectReply: { selectedRowId: 'row1' } }
      })
    ).toMatchObject({ type: 'list_response', rowId: 'row1', title: 'T' })
  })

  it('unwraps view-once wrappers', () => {
    expect(mapZapoContent({ viewOnceMessageV2: { message: { conversation: 'x' } } })).toEqual({
      type: 'text',
      text: 'x'
    })
  })

  it('falls back to unknown', () => {
    expect(mapZapoContent(null)).toEqual({ type: 'unknown' })
  })
})
