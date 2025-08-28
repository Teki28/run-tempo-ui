export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  publishedAt: string;
  author: string;
  tags: string[];
}

export type BlogPostPreview = Omit<BlogPost, 'content'>;
