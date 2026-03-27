export interface PageContent {
  pageId: string;
  text: string;
  fontFamily?: string;
  fontColor?: string;
  fontSize?: string;
  backgroundColor: string;
  imageUrl?: string;
  linkUrl?: string;
  linkText?: string;
}

export interface GlobalSettings {
  logoText: string;
  logoImage?: string;
}
