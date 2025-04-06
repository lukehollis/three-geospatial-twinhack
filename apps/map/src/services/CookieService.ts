/**
 * Utility service for managing cookies
 */
export class CookieService {
  /**
   * Set a cookie with the given name and value
   */
  static setCookie(name: string, value: string, daysToExpire: number = 365): void {
    const date = new Date();
    date.setTime(date.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
  }

  /**
   * Get a cookie value by name
   */
  static getCookie(name: string): string | null {
    const cookieName = `${name}=`;
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.indexOf(cookieName) === 0) {
        return cookie.substring(cookieName.length, cookie.length);
      }
    }
    
    return null;
  }

  /**
   * Delete a cookie by name
   */
  static deleteCookie(name: string): void {
    this.setCookie(name, '', -1);
  }

  /**
   * Generate and set anonymous user ID if not already set
   */
  static getOrCreateAnonymousId(): string {
    const cookieName = 'anon_user_id';
    let userId = this.getCookie(cookieName);
    
    if (!userId) {
      userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.setCookie(cookieName, userId);
    }
    return userId;
  }
} 