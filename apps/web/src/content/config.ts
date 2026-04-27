import { defineCollection, z } from 'astro:content';

const insights = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    category: z.enum(['분석', '트렌드', '활용팁', '운영이야기']),
    thumbnail: z.string().optional(),
    thumbnailAlt: z.string().optional(),
  }),
});

export const collections = { insights };
