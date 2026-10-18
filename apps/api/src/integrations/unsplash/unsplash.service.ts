import { Injectable, Logger } from '@nestjs/common'

const UNSPLASH_API_BASE = 'https://api.unsplash.com'
const UTM_SOURCE = 'aprender-palabras'

export interface UnsplashImage {
  imageUrl: string
  imagePhotographerName: string
  imagePhotographerUrl: string
  imagePageUrl: string
  imageProvider: 'unsplash'
  imageDownloadLocation: string
}

@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name)
  private readonly accessKey: string | null

  constructor() {
    this.accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim() || null
  }

  isConfigured(): boolean {
    return this.accessKey !== null
  }

  async searchImage(query: string): Promise<UnsplashImage | null> {
    if (!this.accessKey) {
      return null
    }

    const trimmedQuery = query.replace(/\s+/g, ' ').trim()
    if (!trimmedQuery) {
      return null
    }

    const params = new URLSearchParams({
      query: trimmedQuery,
      per_page: '1',
      orientation: 'landscape',
      content_filter: 'high',
    })

    try {
      const response = await fetch(
        `${UNSPLASH_API_BASE}/search/photos?${params}`,
        {
          headers: {
            Authorization: `Client-ID ${this.accessKey}`,
            'Accept-Version': 'v1',
          },
        },
      )

      if (!response.ok) {
        this.logger.error(
          `Unsplash search failed with status ${response.status}`,
        )
        return null
      }

      const payload = (await response.json()) as UnsplashSearchResponse
      const photo = payload.results?.[0]
      if (!photo?.urls?.regular || !photo.user?.name) {
        return null
      }

      return {
        imageUrl: photo.urls.regular,
        imagePhotographerName: photo.user.name,
        imagePhotographerUrl: withUtm(photo.user.links.html),
        imagePageUrl: withUtm(photo.links.html),
        imageProvider: 'unsplash',
        imageDownloadLocation: photo.links.download_location,
      }
    } catch (error) {
      this.logger.error('Unsplash search request failed', error)
      return null
    }
  }

  async trackDownload(downloadLocation: string): Promise<void> {
    if (!this.accessKey || !downloadLocation.trim()) {
      return
    }

    try {
      const response = await fetch(downloadLocation, {
        headers: {
          Authorization: `Client-ID ${this.accessKey}`,
          'Accept-Version': 'v1',
        },
      })

      if (!response.ok) {
        this.logger.error(
          `Unsplash download tracking failed with status ${response.status}`,
        )
      }
    } catch (error) {
      this.logger.error('Unsplash download tracking request failed', error)
    }
  }
}

interface UnsplashSearchResponse {
  results?: Array<{
    urls?: {
      regular?: string
    }
    user?: {
      name?: string
      links: {
        html: string
      }
    }
    links: {
      html: string
      download_location: string
    }
  }>
}

function withUtm(url: string): string {
  const parsed = new URL(url)
  parsed.searchParams.set('utm_source', UTM_SOURCE)
  parsed.searchParams.set('utm_medium', 'referral')
  return parsed.toString()
}
