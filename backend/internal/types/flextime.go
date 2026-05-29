// Package types provides shared types used across modules.
package types

import (
	"fmt"
	"strings"
	"time"
)

// FlexTime wraps time.Time and accepts JSON strings both with and without a
// timezone suffix (RFC3339 and "2006-01-02T15:04:05" local-naive format).
// When no timezone is present the time is treated as UTC.
type FlexTime struct {
	time.Time
}

var flexLayouts = []string{
	time.RFC3339,           // 2006-01-02T15:04:05Z / 2006-01-02T15:04:05+03:00
	"2006-01-02T15:04:05",  // no timezone → assume UTC
	"2006-01-02",           // date-only
}

func (ft *FlexTime) UnmarshalJSON(data []byte) error {
	s := strings.Trim(string(data), `"`)
	if s == "null" || s == "" {
		return nil
	}
	for _, layout := range flexLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			ft.Time = t.UTC()
			return nil
		}
	}
	return fmt.Errorf("cannot parse %q as a timestamp", s)
}

func (ft FlexTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + ft.Time.UTC().Format(time.RFC3339) + `"`), nil
}
