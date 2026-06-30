import { Package } from "./package";


export class Project<P extends Package = Package> {
	public readonly mainPackage: P;
	public readonly dependencies: Map<string, P>;
    private usedDependenciesMap = new Map<string, P>();
    
    protected constructor(mainPackage: P, dependencies: Map<string, P>) {
        this.mainPackage = mainPackage;
        this.dependencies = dependencies;
    }

    get usedDependencies() {
        return [...this.usedDependenciesMap.values()];
    }

    static load<P extends Package>(
        mainPackageName: string,
        packageReader: (name: string) => P
    ) {
        const mainPackage = packageReader(mainPackageName);
        const dependencies = new Map<string, P>();
        const tmpQueue = [...mainPackage.dependencies];
        const visited = new Set<string>(mainPackage.dependencies);

        while (tmpQueue.length > 0) {
            const currName = tmpQueue.shift() as string;
            const pkg = packageReader(currName);
            dependencies.set(pkg.name, pkg);

            for (const depName of pkg.dependencies) {
                if (!visited.has(depName)) {
                    visited.add(depName);
                    tmpQueue.push(depName);
                }
            }
        }

        return new Project<P>(mainPackage, dependencies);
    }

    clean() {
        this.mainPackage.clean();
        for (const dep of this.dependencies.values()) {
            dep.clean();
        }
    }

    check() {
        this.mainPackage.check();
    }

    addUsedDependency(pkg: P) {
        if (pkg.name !== this.mainPackage.name) {
            this.usedDependenciesMap.set(pkg.name, pkg);
        }
    }
}
