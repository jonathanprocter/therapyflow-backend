import CoreData
import Foundation

@objc(TreatmentPlanEntity)
public class TreatmentPlanEntity: NSManagedObject {
    @NSManaged public var id: String?
    @NSManaged public var clientId: String?
    @NSManaged public var title: String?
    @NSManaged public var goalsData: Data?
    @NSManaged public var createdAt: Date?
    @NSManaged public var updatedAt: Date?
    @NSManaged public var needsSync: Bool
    @NSManaged public var lastSyncedAt: Date?
}

extension TreatmentPlanEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<TreatmentPlanEntity> {
        return NSFetchRequest<TreatmentPlanEntity>(entityName: "TreatmentPlanEntity")
    }

    func toModel() -> TreatmentPlan {
        TreatmentPlan(
            id: id ?? UUID().uuidString,
            clientId: clientId ?? "",
            therapistId: "",
            clientName: nil,
            diagnosis: nil,
            goals: decodeGoals(),
            interventions: [],
            frequency: nil,
            estimatedDuration: nil,
            startDate: createdAt ?? Date(),
            targetEndDate: nil,
            isActive: true,
            status: .active,
            createdAt: createdAt ?? Date(),
            updatedAt: updatedAt ?? Date()
        )
    }

    func update(from model: TreatmentPlan) {
        id = model.id
        clientId = model.clientId
        title = model.diagnosis ?? "Treatment Plan"
        goalsData = try? JSONEncoder().encode(model.goals)
        createdAt = model.createdAt
        updatedAt = model.updatedAt
        needsSync = true
    }

    private func decodeGoals() -> [TreatmentGoal] {
        guard let data = goalsData else { return [] }
        return (try? JSONDecoder().decode([TreatmentGoal].self, from: data)) ?? []
    }
}
