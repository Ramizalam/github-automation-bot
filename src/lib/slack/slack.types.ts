// =============================================================================
// Slack Block Kit Type Definitions
// =============================================================================
//
// Typed representations of Slack's Block Kit elements.
// These cover the subset we use — the full spec is at:
// https://api.slack.com/reference/block-kit/blocks
// =============================================================================

// ---------------------------------------------------------------------------
// Text Objects
// ---------------------------------------------------------------------------

export interface PlainTextObject {
  type: "plain_text";
  text: string;
  emoji?: boolean;
}

export interface MrkdwnTextObject {
  type: "mrkdwn";
  text: string;
}

export type SlackTextObject = PlainTextObject | MrkdwnTextObject;

// ---------------------------------------------------------------------------
// Block Elements
// ---------------------------------------------------------------------------

export interface ButtonElement {
  type: "button";
  text: PlainTextObject;
  url?: string;
  value?: string;
  action_id?: string;
  style?: "primary" | "danger";
}

export interface ImageElement {
  type: "image";
  image_url: string;
  alt_text: string;
}

export type SlackElement = ButtonElement | ImageElement;

// ---------------------------------------------------------------------------
// Block Types
// ---------------------------------------------------------------------------

export interface HeaderBlock {
  type: "header";
  text: PlainTextObject;
}

export interface SectionBlock {
  type: "section";
  text?: MrkdwnTextObject;
  fields?: MrkdwnTextObject[];
}

export interface DividerBlock {
  type: "divider";
}

export interface ContextBlock {
  type: "context";
  elements: (SlackTextObject | ImageElement)[];
}

export interface ActionsBlock {
  type: "actions";
  elements: SlackElement[];
}

export type SlackBlock =
  | HeaderBlock
  | SectionBlock
  | DividerBlock
  | ContextBlock
  | ActionsBlock;

// ---------------------------------------------------------------------------
// Top-Level Message
// ---------------------------------------------------------------------------

/**
 * The payload sent to Slack's Incoming Webhook endpoint.
 *
 * `text` is required even when using blocks — it serves as:
 *   1. Fallback for clients that don't support Block Kit
 *   2. The notification preview shown in desktop/mobile alerts
 */
export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

/**
 * Configuration for the Slack service, read from environment variables.
 */
export interface SlackConfig {
  webhookUrl: string;
  maxRetries: number;    // default: 3
  retryBaseMs: number;   // base delay for exponential backoff, default: 1000ms
}
