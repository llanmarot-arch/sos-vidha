const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
};

const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

export async function impactAsync(style = ImpactFeedbackStyle.Medium) {
  const map = { light: 20, medium: 40, heavy: 80 };
  vibrate(map[style] || 40);
}

export async function notificationAsync(type = NotificationFeedbackType.Success) {
  const map = {
    success: [30, 40, 30],
    warning: [40, 60, 40],
    error: [80, 60, 80, 60, 80],
  };
  vibrate(map[type] || 30);
}

export async function selectionAsync() {
  vibrate(10);
}

export { ImpactFeedbackStyle, NotificationFeedbackType };
