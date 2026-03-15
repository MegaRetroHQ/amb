export class NotFoundError extends Error {
    resource;
    constructor(resource, message) {
        super(message ?? `${resource} not found`);
        this.name = "NotFoundError";
        this.resource = resource;
    }
}
export class ConflictError extends Error {
    resource;
    constructor(resource, message) {
        super(message ?? `${resource} state conflict`);
        this.name = "ConflictError";
        this.resource = resource;
    }
}
