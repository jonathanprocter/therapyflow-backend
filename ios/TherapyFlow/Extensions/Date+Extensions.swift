import Foundation

extension Date {
    // MARK: - Formatters

    static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter
    }()

    static let mediumDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter
    }()

    static let longDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        return formatter
    }()

    static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HHmm"  // 24-hour military time (e.g., 0900, 1430)
        return formatter
    }()

    static let dateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy HHmm"  // Military time with date
        return formatter
    }()

    static let relativeDateFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter
    }()

    static let dayOfWeekFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter
    }()

    static let monthDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    static let monthYearFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter
    }()

    // MARK: - Formatted Strings

    var shortDate: String {
        Date.shortDateFormatter.string(from: self)
    }

    var mediumDate: String {
        Date.mediumDateFormatter.string(from: self)
    }

    var longDate: String {
        Date.longDateFormatter.string(from: self)
    }

    var timeString: String {
        Date.timeFormatter.string(from: self)
    }

    var dateTimeString: String {
        Date.dateTimeFormatter.string(from: self)
    }

    var relativeString: String {
        Date.relativeDateFormatter.localizedString(for: self, relativeTo: Date())
    }

    var dayOfWeek: String {
        Date.dayOfWeekFormatter.string(from: self)
    }

    var monthDay: String {
        Date.monthDayFormatter.string(from: self)
    }

    var monthYear: String {
        Date.monthYearFormatter.string(from: self)
    }

    // MARK: - Calendar Helpers

    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    var isTomorrow: Bool {
        Calendar.current.isDateInTomorrow(self)
    }

    var isYesterday: Bool {
        Calendar.current.isDateInYesterday(self)
    }

    var isThisWeek: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .weekOfYear)
    }

    var isThisMonth: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .month)
    }

    var isThisYear: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .year)
    }

    var isPast: Bool {
        self < Date()
    }

    var isFuture: Bool {
        self > Date()
    }

    // MARK: - Date Components

    var day: Int {
        Calendar.current.component(.day, from: self)
    }

    var month: Int {
        Calendar.current.component(.month, from: self)
    }

    var year: Int {
        Calendar.current.component(.year, from: self)
    }

    var hour: Int {
        Calendar.current.component(.hour, from: self)
    }

    var minute: Int {
        Calendar.current.component(.minute, from: self)
    }

    var weekday: Int {
        Calendar.current.component(.weekday, from: self)
    }

    // MARK: - Date Manipulation

    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    var endOfDay: Date {
        Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: self) ?? self
    }

    var startOfWeek: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: self)
        return calendar.date(from: components) ?? self
    }

    var endOfWeek: Date {
        Calendar.current.date(byAdding: .day, value: 6, to: startOfWeek) ?? self
    }

    var startOfMonth: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: self)
        return calendar.date(from: components) ?? self
    }

    var endOfMonth: Date {
        Calendar.current.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth) ?? self
    }

    func adding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: self) ?? self
    }

    func adding(weeks: Int) -> Date {
        Calendar.current.date(byAdding: .weekOfYear, value: weeks, to: self) ?? self
    }

    func adding(months: Int) -> Date {
        Calendar.current.date(byAdding: .month, value: months, to: self) ?? self
    }

    func adding(hours: Int) -> Date {
        Calendar.current.date(byAdding: .hour, value: hours, to: self) ?? self
    }

    func adding(minutes: Int) -> Date {
        Calendar.current.date(byAdding: .minute, value: minutes, to: self) ?? self
    }

    // MARK: - Date Comparison

    func isSameDay(as date: Date) -> Bool {
        Calendar.current.isDate(self, inSameDayAs: date)
    }

    func days(from date: Date) -> Int {
        Calendar.current.dateComponents([.day], from: date.startOfDay, to: self.startOfDay).day ?? 0
    }

    func weeks(from date: Date) -> Int {
        Calendar.current.dateComponents([.weekOfYear], from: date, to: self).weekOfYear ?? 0
    }

    func months(from date: Date) -> Int {
        Calendar.current.dateComponents([.month], from: date, to: self).month ?? 0
    }

    // MARK: - Smart Display

    var smartDateString: String {
        if isToday {
            return "Today"
        } else if isTomorrow {
            return "Tomorrow"
        } else if isYesterday {
            return "Yesterday"
        } else if isThisWeek {
            return dayOfWeek
        } else if isThisYear {
            return monthDay
        } else {
            return mediumDate
        }
    }

    var smartDateTimeString: String {
        if isToday {
            return "Today at \(timeString)"
        } else if isTomorrow {
            return "Tomorrow at \(timeString)"
        } else if isYesterday {
            return "Yesterday at \(timeString)"
        } else if isThisWeek {
            return "\(dayOfWeek) at \(timeString)"
        } else {
            return dateTimeString
        }
    }
}

// MARK: - Calendar Date Generation
extension Date {
    /// Returns a calendar configured with Monday as the first day of the week
    static var mondayFirstCalendar: Calendar {
        var calendar = Calendar.current
        calendar.firstWeekday = 2 // Monday = 2
        return calendar
    }

    static func datesInMonth(for date: Date) -> [Date] {
        let calendar = mondayFirstCalendar

        // Use consistent calendar for startOfMonth calculation
        let components = calendar.dateComponents([.year, .month], from: date)
        guard let monthStart = calendar.date(from: components) else { return [] }

        let range = calendar.range(of: .day, in: .month, for: monthStart)!

        return range.compactMap { day in
            calendar.date(bySetting: .day, value: day, of: monthStart)
        }
    }

    static func weeksInMonth(for date: Date) -> [[Date?]] {
        let calendar = mondayFirstCalendar
        let dates = datesInMonth(for: date)

        guard let firstDate = dates.first else { return [] }

        // Get weekday: 1=Sun, 2=Mon, ..., 7=Sat
        // Convert to Monday-first index: Mon=0, Tue=1, ..., Sun=6
        let gregorianWeekday = calendar.component(.weekday, from: firstDate)
        let mondayFirstIndex = (gregorianWeekday + 5) % 7 // Convert: Sun(1)->6, Mon(2)->0, Tue(3)->1, etc.

        var weeks: [[Date?]] = []
        var currentWeek: [Date?] = []

        // Add empty days for the start of the first week
        for _ in 0..<mondayFirstIndex {
            currentWeek.append(nil)
        }

        // Add all dates
        for date in dates {
            currentWeek.append(date)

            // If we've filled a week, add it and start a new one
            if currentWeek.count == 7 {
                weeks.append(currentWeek)
                currentWeek = []
            }
        }

        // Add the last partial week if any days remain
        if !currentWeek.isEmpty {
            // Pad with nil to make 7 days
            while currentWeek.count < 7 {
                currentWeek.append(nil)
            }
            weeks.append(currentWeek)
        }

        return weeks
    }
}

// MARK: - Array Chunking Helper
extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
